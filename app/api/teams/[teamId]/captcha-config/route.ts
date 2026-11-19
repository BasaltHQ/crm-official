import { NextRequest, NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";
import { encryptSecret, isMaskedSecret, maskSecretValue } from "@/lib/encryption";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

// POST /api/teams/[teamId]/captcha-config - Update team Captcha configuration
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
        }

        const { teamId } = await params;

        if (!validateResourceOwnership(teamInfo!.teamId, teamId, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Not authorized to modify this team's settings" }, { status: 403 });
        }

        const body = await request.json();
        const { site_key, secret_key } = body;

        if (typeof site_key !== "string") {
            return NextResponse.json({ error: "site_key is required" }, { status: 400 });
        }

        const existing = await prismadb.teamCaptchaConfig.findUnique({
            where: { team_id: teamId },
            select: { secret_key: true },
        });

        const encryptedSecret =
            isMaskedSecret(secret_key) || secret_key === "HasValue"
                ? existing?.secret_key || ""
                : encryptSecret(secret_key) || "";

        const config = await prismadb.teamCaptchaConfig.upsert({
            where: { team_id: teamId },
            create: {
                team_id: teamId,
                site_key,
                secret_key: encryptedSecret,
            },
            update: {
                site_key,
                secret_key: encryptedSecret,
            },
        });

        await logActivityInternal(
            session!.user.id,
            "UPDATE",
            "TeamCaptchaConfig",
            `Updated CAPTCHA config for team ${teamId}`,
            teamId
        );

        return NextResponse.json({
            ...config,
            secret_key: maskSecretValue(config.secret_key),
        });
    } catch (error) {
        systemLogger.error("[TEAM_CAPTCHA_CONFIG_POST]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET /api/teams/[teamId]/captcha-config - Get team Captcha configuration
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
        }

        const { teamId } = await params;

        if (!validateResourceOwnership(teamInfo!.teamId, teamId, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const config = await prismadb.teamCaptchaConfig.findUnique({
            where: { team_id: teamId },
        });

        if (!config) {
            return NextResponse.json(null);
        }

        return NextResponse.json({
            ...config,
            secret_key: maskSecretValue(config.secret_key),
        });
    } catch (error) {
        systemLogger.error("[TEAM_CAPTCHA_CONFIG_GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
