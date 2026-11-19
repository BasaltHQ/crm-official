import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { prismadb } from "@/lib/prisma";
import { logActivityInternal } from "@/actions/audit";
import { encryptSecret, decryptSecret } from "@/lib/encryption";

const SECRET_FIELDS = [
    "brand_ein",
    "brand_street",
    "brand_city",
    "brand_state",
    "brand_postal_code",
    "brand_contact_email",
    "brand_contact_phone",
    "brand_support_email",
    "brand_support_phone",
] as const;

const TENANT_STRING_FIELDS = [
    "brand_name",
    "brand_ein",
    "brand_vertical",
    "brand_company_type",
    "brand_website_url",
    "brand_street",
    "brand_city",
    "brand_state",
    "brand_postal_code",
    "brand_country_code",
    "brand_contact_email",
    "brand_contact_phone",
    "brand_support_email",
    "brand_support_phone",
    "campaign_use_case",
    "campaign_description",
    "campaign_message_flow",
    "campaign_help_message",
    "campaign_opt_out_message",
] as const;

const PLATFORM_ONLY_STRING_FIELDS = [
    "brand_registration_id",
    "campaign_registration_id",
    "phone_number_id",
    "phone_number",
    "phone_number_arn",
    "phone_number_status",
] as const;

const TENANT_ALLOWED_STATUSES = new Set(["PENDING", "DRAFT"]);

export async function GET(_req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return new NextResponse("Forbidden: Admin privileges required", { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const config = await prismadb.teamSmsConfig.findUnique({
        where: { team_id: params.teamId },
    });

    if (!config) {
        return NextResponse.json(null);
    }

    const cloned: Record<string, any> = { ...config };
    for (const field of SECRET_FIELDS) {
        if (cloned[field]) {
            cloned[field] = decryptSecret(cloned[field]);
        }
    }

    return NextResponse.json(cloned);
}

export async function POST(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return new NextResponse("Forbidden: Admin privileges required", { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const platformAdmin = await requirePlatformAdmin();
    const isPlatformAdmin = Boolean(platformAdmin);

    const body = await req.json();
    const safeData: Record<string, any> = {};

    for (const key of TENANT_STRING_FIELDS) {
        if (body[key] === null || typeof body[key] === "string") {
            safeData[key] = body[key];
        }
    }

    if (Array.isArray(body.campaign_sample_messages)) {
        safeData.campaign_sample_messages = body.campaign_sample_messages.filter(
            (item: unknown): item is string => typeof item === "string"
        );
    }

    if (typeof body.monthly_budget === "number" && Number.isFinite(body.monthly_budget)) {
        safeData.monthly_budget = Math.max(0, body.monthly_budget);
    }

    if (typeof body.daily_limit === "number" && Number.isFinite(body.daily_limit)) {
        safeData.daily_limit = Math.max(0, Math.round(body.daily_limit));
    }

    if (body.brand_submitted_at) {
        const dt = new Date(body.brand_submitted_at);
        if (!isNaN(dt.getTime())) safeData.brand_submitted_at = dt;
    }
    if (body.campaign_submitted_at) {
        const dt = new Date(body.campaign_submitted_at);
        if (!isNaN(dt.getTime())) safeData.campaign_submitted_at = dt;
    }

    // Status & carrier/phone approval fields: strictly block tenant self-approval
    if (body.brand_status !== undefined) {
        const requestedStatus = String(body.brand_status).toUpperCase();
        if (!isPlatformAdmin && !TENANT_ALLOWED_STATUSES.has(requestedStatus)) {
            return NextResponse.json(
                { error: "Forbidden: Only Platform Admins can approve 10DLC brand status" },
                { status: 403 }
            );
        }
        safeData.brand_status = requestedStatus;
    }

    if (body.campaign_status !== undefined) {
        const requestedStatus = String(body.campaign_status).toUpperCase();
        if (!isPlatformAdmin && !TENANT_ALLOWED_STATUSES.has(requestedStatus)) {
            return NextResponse.json(
                { error: "Forbidden: Only Platform Admins can approve 10DLC campaign status" },
                { status: 403 }
            );
        }
        safeData.campaign_status = requestedStatus;
    }

    if (isPlatformAdmin) {
        for (const key of PLATFORM_ONLY_STRING_FIELDS) {
            if (body[key] === null || typeof body[key] === "string") {
                safeData[key] = body[key];
            }
        }
        if (typeof body.sms_enabled === "boolean") {
            safeData.sms_enabled = body.sms_enabled;
        }
        if (body.brand_approved_at) {
            const dt = new Date(body.brand_approved_at);
            if (!isNaN(dt.getTime())) safeData.brand_approved_at = dt;
        }
        if (body.campaign_approved_at) {
            const dt = new Date(body.campaign_approved_at);
            if (!isNaN(dt.getTime())) safeData.campaign_approved_at = dt;
        }
    }

    for (const field of SECRET_FIELDS) {
        if (typeof safeData[field] === "string" && safeData[field].length > 0) {
            safeData[field] = encryptSecret(safeData[field]);
        }
    }

    try {
        const existingConfig = await prismadb.teamSmsConfig.findUnique({
            where: { team_id: params.teamId },
        });

        const config = await prismadb.teamSmsConfig.upsert({
            where: { team_id: params.teamId },
            create: {
                team_id: params.teamId,
                ...safeData,
            },
            update: {
                ...safeData,
            },
        });

        const isNewSubmission =
            safeData.brand_status === "PENDING" && existingConfig?.brand_status !== "PENDING";

        if (isNewSubmission) {
            try {
                const team = await prismadb.team.findUnique({ where: { id: params.teamId } });
                const admins = await prismadb.users.findMany({ where: { is_admin: true } });

                if (admins.length > 0) {
                    const subject = `ACTION REQUIRED: 10DLC SMS Registration for ${team?.name || "A Team"}`;
                    const rawBody = `Team ${team?.name} has submitted their 10DLC SMS registration via the self-serve wizard.\n\nBrand: ${safeData.brand_name || "N/A"}\nUse Case: ${safeData.campaign_use_case || "N/A"}\n\nPlease review in the Partner Dashboard and process via AWS EUM.`;

                    await prismadb.internalMessage.create({
                        data: {
                            tenant_id: params.teamId,
                            subject: subject,
                            body: rawBody,
                            sender_id: session!.user.id,
                            recipients: {
                                create: admins.map((admin: any) => ({ user_id: admin.id })),
                            },
                        },
                    });

                    const { sendEmailSES } = await import("@/lib/aws/ses");
                    for (const admin of admins) {
                        if (admin.email) {
                            await sendEmailSES({
                                to: admin.email,
                                subject: subject,
                                text: rawBody,
                            }).catch((e) => console.error("Failed to send 10DLC admin alert email", e));
                        }
                    }
                }
            } catch (alertErr) {
                console.error("Failed to generate 10DLC alerts:", alertErr);
            }
        }

        await logActivityInternal(
            session!.user.id,
            "UPDATE",
            "TeamSmsConfig",
            `Updated SMS configuration for team ${params.teamId}`,
            params.teamId
        );
        return NextResponse.json(config);
    } catch (error: any) {
        console.error("Failed to save SMS config:", error);
        return new NextResponse("Failed to save config", { status: 500 });
    }
}
