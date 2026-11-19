import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { SES } from "@aws-sdk/client-ses";
import { SNSClient, CreateTopicCommand, SubscribeCommand, DeleteTopicCommand } from "@aws-sdk/client-sns";

const SES_REGION = process.env.AWS_REGION || "us-west-2";
const ACTIVE_RULE_SET_NAME = "AmazonConnectEnabledRuleSet-DO-NOT-DELETE";
const WEBHOOK_ENDPOINT = `${process.env.NEXT_PUBLIC_APP_URL || "https://crm.basalthq.com"}/api/email/inbound`;
const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function getAwsCredentials() {
    return {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        ...(process.env.AWS_SESSION_TOKEN ? { sessionToken: process.env.AWS_SESSION_TOKEN } : {}),
    };
}

/**
 * POST /api/teams/[teamId]/email-config/reply-domain
 */
export async function POST(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const rawDomain = String(body.domain || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim().toLowerCase();

    if (!rawDomain || !DOMAIN_REGEX.test(rawDomain)) {
        return NextResponse.json({ error: "Valid domain required (e.g. reply.acmecorp.com)" }, { status: 400 });
    }

    try {
        const credentials = getAwsCredentials();
        const ses = new SES({ region: SES_REGION, credentials });
        const sns = new SNSClient({ region: SES_REGION, credentials });

        systemLogger.info(`[REPLY_DOMAIN] Verifying domain: ${rawDomain}`);
        const [verifyResult, dkimResult] = await Promise.all([
            ses.verifyDomainIdentity({ Domain: rawDomain }),
            ses.verifyDomainDkim({ Domain: rawDomain }),
        ]);
        const verificationToken = verifyResult.VerificationToken;
        const dkimTokens = dkimResult.DkimTokens || [];

        const topicName = `crm-reply-${params.teamId.substring(0, 12)}-${rawDomain.replace(/\./g, "-")}`;
        const topicResult = await sns.send(new CreateTopicCommand({ Name: topicName }));
        const topicArn = topicResult.TopicArn;

        if (!topicArn) throw new Error("Failed to create SNS topic");

        await sns.send(new SubscribeCommand({
            TopicArn: topicArn,
            Protocol: "https",
            Endpoint: WEBHOOK_ENDPOINT,
        }));

        const ruleName = `crm-reply-${params.teamId.substring(0, 12)}`;
        await ses.createReceiptRule({
            RuleSetName: ACTIVE_RULE_SET_NAME,
            Rule: {
                Name: ruleName,
                Enabled: true,
                TlsPolicy: "Optional",
                Recipients: [rawDomain],
                Actions: [{
                    SNSAction: {
                        TopicArn: topicArn,
                        Encoding: "UTF-8",
                    }
                }],
                ScanEnabled: true,
            },
        });

        const existingConfig = await prismadb.teamEmailConfig.findUnique({
            where: { team_id_purpose: { team_id: params.teamId, purpose: "INBOUND" } }
        });

        const replyData = {
            reply_domain: rawDomain,
            reply_domain_status: "PENDING_MX",
            reply_sns_topic_arn: topicArn,
            reply_receipt_rule: ruleName,
            reply_dkim_tokens: dkimTokens,
            reply_verification_token: verificationToken || null,
        };

        if (existingConfig) {
            await prismadb.teamEmailConfig.update({
                where: { id: existingConfig.id },
                data: replyData as any,
            });
        } else {
            await prismadb.teamEmailConfig.create({
                data: {
                    team_id: params.teamId,
                    purpose: "INBOUND",
                    provider: "PLATFORM_SES",
                    from_email: `inbound@${rawDomain}`,
                    verification_status: "VERIFIED",
                    ...replyData,
                } as any,
            });
        }

        systemLogger.info(`[REPLY_DOMAIN] Setup complete for ${rawDomain} (team: ${params.teamId})`);

        return NextResponse.json({
            success: true,
            domain: rawDomain,
            status: "PENDING_MX",
            mxRecord: {
                type: "MX",
                name: rawDomain,
                value: `inbound-smtp.${SES_REGION}.amazonaws.com`,
                priority: 10,
            },
            dkimRecords: dkimTokens.map((token: string) => ({
                type: "CNAME",
                name: `${token}._domainkey.${rawDomain}`,
                value: `${token}.dkim.amazonses.com`,
            })),
            verificationRecord: verificationToken ? {
                type: "TXT",
                name: `_amazonses.${rawDomain}`,
                value: verificationToken,
            } : undefined,
            message: `Reply domain ${rawDomain} is set up. Add the DNS records below to complete verification.`,
        });

    } catch (error: any) {
        systemLogger.error("[REPLY_DOMAIN_POST]", error);
        return NextResponse.json({ error: "Failed to set up reply domain" }, { status: 500 });
    }
}

/**
 * GET /api/teams/[teamId]/email-config/reply-domain
 */
export async function GET(_req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const config = await prismadb.teamEmailConfig.findUnique({
        where: { team_id_purpose: { team_id: params.teamId, purpose: "INBOUND" } }
    });

    if (!config?.reply_domain) {
        return NextResponse.json({ domain: null, status: null });
    }

    if (config.reply_domain_status === "PENDING_MX") {
        try {
            const ses = new SES({ region: SES_REGION, credentials: getAwsCredentials() });
            const result = await ses.getIdentityVerificationAttributes({
                Identities: [config.reply_domain]
            });
            const attr = result.VerificationAttributes?.[config.reply_domain];
            if (attr?.VerificationStatus === "Success") {
                await prismadb.teamEmailConfig.update({
                    where: { id: config.id },
                    data: {
                        reply_domain_status: "VERIFIED",
                        reply_domain_verified_at: new Date(),
                    } as any,
                });
                return NextResponse.json({
                    domain: config.reply_domain,
                    status: "VERIFIED",
                    topicArn: config.reply_sns_topic_arn,
                });
            }
        } catch (err: any) {
            systemLogger.warn(`[REPLY_DOMAIN] Failed to check SES status: ${err.message}`);
        }
    }

    const dkimTokens = Array.isArray((config as any).reply_dkim_tokens) ? (config as any).reply_dkim_tokens as string[] : [];
    const verificationToken = (config as any).reply_verification_token as string | undefined;
    const isNotVerified = config.reply_domain_status !== "VERIFIED";

    return NextResponse.json({
        domain: config.reply_domain,
        status: config.reply_domain_status,
        topicArn: config.reply_sns_topic_arn,
        verifiedAt: config.reply_domain_verified_at,
        mxRecord: isNotVerified ? {
            type: "MX",
            name: config.reply_domain,
            value: `inbound-smtp.${SES_REGION}.amazonaws.com`,
            priority: 10,
        } : undefined,
        dkimRecords: isNotVerified && dkimTokens.length > 0 ? dkimTokens.map((token: string) => ({
            type: "CNAME",
            name: `${token}._domainkey.${config.reply_domain}`,
            value: `${token}.dkim.amazonses.com`,
        })) : undefined,
        verificationRecord: isNotVerified && verificationToken ? {
            type: "TXT",
            name: `_amazonses.${config.reply_domain}`,
            value: verificationToken,
        } : undefined,
    });
}

/**
 * DELETE /api/teams/[teamId]/email-config/reply-domain
 */
export async function DELETE(_req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const config = await prismadb.teamEmailConfig.findUnique({
            where: { team_id_purpose: { team_id: params.teamId, purpose: "INBOUND" } }
        });

        if (!config?.reply_domain) {
            return NextResponse.json({ error: "No reply domain configured" }, { status: 404 });
        }

        const credentials = getAwsCredentials();
        const ses = new SES({ region: SES_REGION, credentials });
        const sns = new SNSClient({ region: SES_REGION, credentials });

        if (config.reply_receipt_rule) {
            try {
                await ses.deleteReceiptRule({
                    RuleSetName: ACTIVE_RULE_SET_NAME,
                    RuleName: config.reply_receipt_rule as string,
                });
            } catch (e: any) {
                systemLogger.warn(`[REPLY_DOMAIN] Failed to delete receipt rule: ${e.message}`);
            }
        }

        if (config.reply_sns_topic_arn) {
            try {
                await sns.send(new DeleteTopicCommand({ TopicArn: config.reply_sns_topic_arn as string }));
            } catch (e: any) {
                systemLogger.warn(`[REPLY_DOMAIN] Failed to delete SNS topic: ${e.message}`);
            }
        }

        try {
            await ses.deleteIdentity({ Identity: config.reply_domain });
        } catch (e: any) {
            systemLogger.warn(`[REPLY_DOMAIN] Failed to delete SES identity: ${e.message}`);
        }

        await prismadb.teamEmailConfig.update({
            where: { id: config.id },
            data: {
                reply_domain: null,
                reply_domain_status: null,
                reply_sns_topic_arn: null,
                reply_receipt_rule: null,
                reply_domain_verified_at: null,
            } as any,
        });

        systemLogger.info(`[REPLY_DOMAIN] Cleaned up reply domain for team ${params.teamId}`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        systemLogger.error("[REPLY_DOMAIN_DELETE]", error);
        return NextResponse.json({ error: "Failed to remove reply domain" }, { status: 500 });
    }
}
