import { NextRequest, NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { prismadb } from "@/lib/prisma";
import { logActivityInternal } from "@/actions/audit";
import { encryptSecret, isMaskedSecret, maskSecretValue } from "@/lib/encryption";
import { systemLogger } from "@/lib/logger";

// POST /api/teams/[teamId]/ai-config - Update team AI configuration
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

        let body: any;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: "Invalid or empty request body" }, { status: 400 });
        }

        const { provider, modelId, useSystemKey, apiKey, services } = body;

        if (!provider || typeof provider !== "string" || provider.trim().length === 0) {
            return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
        }

        const existingTeamConfig = await prismadb.teamAiConfig.findUnique({
            where: { team_id: teamId },
            select: { apiKey: true },
        });

        let encryptedKey: string | null = null;
        if (!useSystemKey) {
            if (isMaskedSecret(apiKey) || apiKey === "HasValue") {
                encryptedKey = existingTeamConfig?.apiKey ?? null;
            } else {
                encryptedKey = encryptSecret(apiKey || null);
            }
        }

        const config = await prismadb.teamAiConfig.upsert({
            where: { team_id: teamId },
            create: {
                team_id: teamId,
                provider,
                modelId: modelId || null,
                useSystemKey: useSystemKey ?? true,
                apiKey: encryptedKey,
                configuration: { services: services || {} },
            },
            update: {
                provider,
                modelId: modelId || null,
                useSystemKey: useSystemKey ?? true,
                apiKey: encryptedKey,
                configuration: { services: services || {} },
            },
        });

        // ONLY verified Platform Admins may write global SystemAiConfig
        const platformAdmin = await requirePlatformAdmin();
        if (platformAdmin && !teamInfo!.isImpersonating) {
            try {
                const existingSystemConfig = await prismadb.systemAiConfig.findFirst({
                    where: { provider },
                });

                const systemConfigData: any = {
                    provider,
                    defaultModelId: modelId || null,
                    isActive: true,
                    configuration: { services: services || {} },
                };

                if (provider === "BEDROCK") {
                    systemConfigData.apiKey = "MANAGED_BY_IAM";
                } else if (!useSystemKey && encryptedKey) {
                    systemConfigData.apiKey = encryptedKey;
                }

                if (existingSystemConfig) {
                    await prismadb.systemAiConfig.update({
                        where: { id: existingSystemConfig.id },
                        data: systemConfigData,
                    });
                } else {
                    await prismadb.systemAiConfig.create({
                        data: systemConfigData,
                    });
                }

                systemLogger.info(
                    `[SYSTEM_AI_CONFIG] Platform admin updated global AI defaults: provider=${provider}, model=${modelId}`
                );
            } catch (sysErr) {
                systemLogger.error("[SYSTEM_AI_CONFIG] Failed to update system config:", sysErr);
            }
        }

        await logActivityInternal(
            session!.user.id,
            "UPDATE",
            "TeamAiConfig",
            `Updated AI config for team ${teamId} (provider: ${provider})`,
            teamId
        );

        return NextResponse.json({
            ...config,
            apiKey: maskSecretValue(config.apiKey),
        });
    } catch (error) {
        systemLogger.error("[TEAM_AI_CONFIG_POST]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// GET /api/teams/[teamId]/ai-config - Get team AI configuration
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

        const config = await prismadb.teamAiConfig.findUnique({
            where: { team_id: teamId },
        });

        if (!config) {
            return NextResponse.json(null);
        }

        return NextResponse.json({
            ...config,
            apiKey: maskSecretValue(config.apiKey),
        });
    } catch (error) {
        systemLogger.error("[TEAM_AI_CONFIG_GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
