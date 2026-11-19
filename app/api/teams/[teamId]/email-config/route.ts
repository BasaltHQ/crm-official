import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";
import { verifyEmailIdentity, getIdentityVerificationStatus, deleteEmailIdentity } from "@/lib/aws/ses-verify";
import { logActivityInternal } from "@/actions/audit";
import { encryptSecret, decryptSecret, isMaskedSecret } from "@/lib/encryption";
import { systemLogger } from "@/lib/logger";

const VALID_PURPOSES = ["GENERAL", "OUTREACH", "INBOUND"] as const;

function isPlaceholderSecret(val: unknown): boolean {
    return val === "HasValue" || isMaskedSecret(val);
}

function resolveIncomingSecret(incoming: unknown, existing: string | null | undefined): string | null | undefined {
    if (!incoming || isPlaceholderSecret(incoming)) {
        return existing;
    }
    return typeof incoming === "string" ? incoming : existing;
}

function maskConfig(config: any) {
    return {
        ...config,
        aws_access_key_id: config.aws_access_key_id ? "HasValue" : null,
        aws_secret_access_key: config.aws_secret_access_key ? "HasValue" : null,
        resend_api_key: config.resend_api_key ? "HasValue" : null,
        sendgrid_api_key: config.sendgrid_api_key ? "HasValue" : null,
        mailgun_api_key: config.mailgun_api_key ? "HasValue" : null,
        postmark_api_token: config.postmark_api_token ? "HasValue" : null,
        smtp_password: config.smtp_password ? "HasValue" : null,
    };
}

export async function GET(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const purpose = url.searchParams.get("purpose")?.toUpperCase();

    if (purpose && VALID_PURPOSES.includes(purpose as any)) {
        const config = await prismadb.teamEmailConfig.findUnique({
            where: { team_id_purpose: { team_id: params.teamId, purpose } }
        });

        if (!config) return NextResponse.json(null);

        if ((config.provider === "AWS_SES" || config.provider === "PLATFORM_SES") && config.verification_status === "PENDING") {
            const creds = config.provider === "AWS_SES" && config.aws_access_key_id && config.aws_secret_access_key
                ? { accessKeyId: config.aws_access_key_id, secretAccessKey: decryptSecret(config.aws_secret_access_key) || config.aws_secret_access_key, region: config.aws_region }
                : undefined;

            const currentStatus = await getIdentityVerificationStatus(config.from_email, creds);
            if (currentStatus !== "PENDING") {
                const updated = await prismadb.teamEmailConfig.update({
                    where: { id: config.id },
                    data: { verification_status: currentStatus === "SUCCESS" ? "VERIFIED" : currentStatus }
                });
                return NextResponse.json(maskConfig(updated));
            }
        }

        return NextResponse.json(maskConfig(config));
    }

    const configs = await prismadb.teamEmailConfig.findMany({
        where: { team_id: params.teamId }
    });

    const results = [];
    for (const config of configs) {
        if ((config.provider === "AWS_SES" || config.provider === "PLATFORM_SES") && config.verification_status === "PENDING") {
            try {
                const creds = config.provider === "AWS_SES" && config.aws_access_key_id && config.aws_secret_access_key
                    ? { accessKeyId: config.aws_access_key_id, secretAccessKey: decryptSecret(config.aws_secret_access_key) || config.aws_secret_access_key, region: config.aws_region }
                    : undefined;

                const currentStatus = await getIdentityVerificationStatus(config.from_email, creds);
                if (currentStatus !== "PENDING") {
                    const updated = await prismadb.teamEmailConfig.update({
                        where: { id: config.id },
                        data: { verification_status: currentStatus === "SUCCESS" ? "VERIFIED" : currentStatus }
                    });
                    results.push(maskConfig(updated));
                    continue;
                }
            } catch {
                // Non-fatal — just return current status
            }
        }
        results.push(maskConfig(config));
    }

    return NextResponse.json(results);
}

export async function POST(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
        purpose = "GENERAL",
        provider = "AWS_SES",
        from_email,
        from_name,
        aws_access_key_id,
        aws_secret_access_key,
        aws_region,
        resend_api_key,
        sendgrid_api_key,
        mailgun_api_key,
        mailgun_domain,
        mailgun_region,
        postmark_api_token,
        smtp_host,
        smtp_port,
        smtp_user,
        smtp_password
    } = body;

    const normalizedPurpose = (purpose || "GENERAL").toUpperCase();
    if (!VALID_PURPOSES.includes(normalizedPurpose as any)) {
        return NextResponse.json({ error: "Invalid purpose. Must be GENERAL, OUTREACH, or INBOUND." }, { status: 400 });
    }

    if (!from_email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    try {
        const existingConfig = await prismadb.teamEmailConfig.findUnique({
            where: { team_id_purpose: { team_id: params.teamId, purpose: normalizedPurpose } }
        });

        const finalAwsKey = resolveIncomingSecret(aws_access_key_id, existingConfig?.aws_access_key_id);
        const finalAwsSecret = resolveIncomingSecret(aws_secret_access_key, existingConfig?.aws_secret_access_key);
        const finalResendKey = resolveIncomingSecret(resend_api_key, existingConfig?.resend_api_key);
        const finalSendgridKey = resolveIncomingSecret(sendgrid_api_key, existingConfig?.sendgrid_api_key);
        const finalMailgunKey = resolveIncomingSecret(mailgun_api_key, existingConfig?.mailgun_api_key);
        const finalPostmarkToken = resolveIncomingSecret(postmark_api_token, existingConfig?.postmark_api_token);
        const finalSmtpPassword = resolveIncomingSecret(smtp_password, existingConfig?.smtp_password);

        let verificationStatus = "PENDING";

        if (provider === "PLATFORM_SES") {
            const triggerVerification = !existingConfig || existingConfig.from_email !== from_email || existingConfig.provider !== "PLATFORM_SES";
            if (triggerVerification) {
                await verifyEmailIdentity(from_email);
            }
            const status = await getIdentityVerificationStatus(from_email);
            if (status === "SUCCESS") verificationStatus = "VERIFIED";
        } else if (provider === "AWS_SES") {
            if (!finalAwsKey || !finalAwsSecret) return NextResponse.json({ error: "AWS Credentials required" }, { status: 400 });
            const rawAwsSecret = decryptSecret(finalAwsSecret) || finalAwsSecret;
            const triggerVerification = !existingConfig || existingConfig.from_email !== from_email || existingConfig.provider !== "AWS_SES";
            if (triggerVerification) {
                await verifyEmailIdentity(from_email, { accessKeyId: finalAwsKey, secretAccessKey: rawAwsSecret, region: aws_region || "us-east-1" });
            }
            const status = await getIdentityVerificationStatus(from_email, { accessKeyId: finalAwsKey, secretAccessKey: rawAwsSecret, region: aws_region || "us-east-1" });
            if (status === "SUCCESS") verificationStatus = "VERIFIED";
        } else if (provider === "RESEND") {
            if (!finalResendKey) return NextResponse.json({ error: "Resend API Key required" }, { status: 400 });
            verificationStatus = "VERIFIED";
        } else if (provider === "SENDGRID") {
            if (!finalSendgridKey) return NextResponse.json({ error: "SendGrid API Key required" }, { status: 400 });
            verificationStatus = "VERIFIED";
        } else if (provider === "MAILGUN") {
            if (!finalMailgunKey || !mailgun_domain) return NextResponse.json({ error: "Mailgun Config required" }, { status: 400 });
            verificationStatus = "VERIFIED";
        } else if (provider === "POSTMARK") {
            if (!finalPostmarkToken) return NextResponse.json({ error: "Postmark Token required" }, { status: 400 });
            verificationStatus = "VERIFIED";
        } else if (provider === "SMTP") {
            if (!smtp_host || !smtp_port || !smtp_user || !finalSmtpPassword) return NextResponse.json({ error: "SMTP Config required" }, { status: 400 });
            verificationStatus = "VERIFIED";
        } else if (provider === "GOOGLE_GMAIL") {
            verificationStatus = "VERIFIED";
        }

        let config;

        const updateData = {
            provider,
            from_email,
            from_name,
            aws_access_key_id: provider === "AWS_SES" ? finalAwsKey : undefined,
            aws_secret_access_key: provider === "AWS_SES" ? encryptSecret(finalAwsSecret) : undefined,
            aws_region: provider === "AWS_SES" ? (aws_region || "us-east-1") : undefined,
            resend_api_key: provider === "RESEND" ? encryptSecret(finalResendKey) : undefined,
            sendgrid_api_key: provider === "SENDGRID" ? encryptSecret(finalSendgridKey) : undefined,
            mailgun_api_key: provider === "MAILGUN" ? encryptSecret(finalMailgunKey) : undefined,
            mailgun_domain: provider === "MAILGUN" ? mailgun_domain : undefined,
            mailgun_region: provider === "MAILGUN" ? (mailgun_region || "us") : undefined,
            postmark_api_token: provider === "POSTMARK" ? encryptSecret(finalPostmarkToken) : undefined,
            smtp_host: provider === "SMTP" ? smtp_host : undefined,
            smtp_port: provider === "SMTP" ? parseInt(String(smtp_port)) : undefined,
            smtp_user: provider === "SMTP" ? smtp_user : undefined,
            smtp_password: provider === "SMTP" ? encryptSecret(finalSmtpPassword) : undefined,
            verification_status: verificationStatus,
        };

        if (existingConfig) {
            config = await prismadb.teamEmailConfig.update({
                where: { id: existingConfig.id },
                data: updateData
            });
        } else {
            config = await prismadb.teamEmailConfig.create({
                data: {
                    team_id: params.teamId,
                    purpose: normalizedPurpose,
                    provider,
                    from_email,
                    from_name,
                    aws_access_key_id: provider === "AWS_SES" ? finalAwsKey : null,
                    aws_secret_access_key: provider === "AWS_SES" ? encryptSecret(finalAwsSecret) : null,
                    aws_region: provider === "AWS_SES" ? (aws_region || "us-east-1") : "us-east-1",
                    resend_api_key: provider === "RESEND" ? encryptSecret(finalResendKey) : null,
                    sendgrid_api_key: provider === "SENDGRID" ? encryptSecret(finalSendgridKey) : null,
                    mailgun_api_key: provider === "MAILGUN" ? encryptSecret(finalMailgunKey) : null,
                    mailgun_domain: mailgun_domain || null,
                    mailgun_region: mailgun_region || "us",
                    postmark_api_token: provider === "POSTMARK" ? encryptSecret(finalPostmarkToken) : null,
                    smtp_host: smtp_host || null,
                    smtp_port: smtp_port ? parseInt(String(smtp_port)) : null,
                    smtp_user: smtp_user || null,
                    smtp_password: provider === "SMTP" ? encryptSecret(finalSmtpPassword) : null,
                    verification_status: verificationStatus,
                }
            });
        }

        await logActivityInternal(
            session!.user.id,
            "UPDATE",
            "TeamEmailConfig",
            `Updated email config for team ${params.teamId} (provider: ${provider}, purpose: ${normalizedPurpose})`,
            params.teamId
        );

        return NextResponse.json(maskConfig(config));
    } catch (error: any) {
        systemLogger.error("[EMAIL_CONFIG_POST]", error);
        return NextResponse.json({ error: "Failed to set config" }, { status: 500 });
    }
}

export async function DELETE(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const purpose = (url.searchParams.get("purpose") || "GENERAL").toUpperCase();

    const config = await prismadb.teamEmailConfig.findUnique({
        where: { team_id_purpose: { team_id: params.teamId, purpose } }
    });

    if (!config) {
        return NextResponse.json({ error: "Configuration not found" }, { status: 404 });
    }

    try {
        if (config.provider === "PLATFORM_SES") {
            await deleteEmailIdentity(config.from_email);
        } else if (config.provider === "AWS_SES" && config.aws_access_key_id && config.aws_secret_access_key) {
            await deleteEmailIdentity(config.from_email, {
                accessKeyId: config.aws_access_key_id,
                secretAccessKey: decryptSecret(config.aws_secret_access_key) || config.aws_secret_access_key,
                region: config.aws_region
            });
        }
    } catch (err) {
        console.error("Failed to delete identity", err);
    }

    await prismadb.teamEmailConfig.delete({
        where: { id: config.id }
    });

    await logActivityInternal(
        session!.user.id,
        "DELETE",
        "TeamEmailConfig",
        `Deleted email config for team ${params.teamId} (provider: ${config.provider}, purpose: ${purpose})`,
        params.teamId
    );
    return new NextResponse(null, { status: 204 });
}
