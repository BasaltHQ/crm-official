import { NextRequest, NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { maskSecretValue } from "@/lib/encryption";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { getTeamLeadGenCredits } from "@/lib/scraper/credits";
import { getTeamAiTokenBalance } from "@/lib/ai-tokens";

// GET /api/teams/[teamId]/ai-config/data - Get all AI config data for the form
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

        const [teamConfig, systemConfigs, activeModels] = await Promise.all([
            prismadb.teamAiConfig.findUnique({
                where: { team_id: teamId },
            }),
            prismadb.systemAiConfig.findMany({
                select: {
                    provider: true,
                    isActive: true,
                    apiKey: true,
                },
            }),
            prismadb.aiModel.findMany({
                where: { isActive: true },
                orderBy: { name: "asc" },
            }),
        ]);

        const isProviderEnabled = (providerSlug: string) => {
            const config = (systemConfigs as any[]).find((c) => c.provider === providerSlug);
            return config ? config.isActive : true;
        };

        let registeredProviders: string[] = [];
        try {
            const providerRegistry = await prismadb.aiProviderRegistry.findMany({
                where: { isActive: true },
                select: { slug: true },
            });
            registeredProviders = (providerRegistry as any[]).map((p) => p.slug);
        } catch {
            registeredProviders = Array.from(new Set((activeModels as any[]).map((m) => m.provider)));
        }

        const enabledProviders = registeredProviders.filter(isProviderEnabled);

        const providersWithSystemKey = (systemConfigs as any[])
            .filter((c) => c.apiKey && c.apiKey.trim().length > 0)
            .map((c) => c.provider);

        const [leadgenCredits, aiTokensBalance] = await Promise.all([
            getTeamLeadGenCredits(teamId),
            getTeamAiTokenBalance(teamId),
        ]);

        return NextResponse.json({
            teamConfig: teamConfig
                ? {
                      ...teamConfig,
                      apiKey: maskSecretValue(teamConfig.apiKey),
                  }
                : null,
            activeModels,
            enabledProviders,
            providersWithSystemKey,
            leadgenCredits,
            aiTokensBalance,
        });
    } catch (error) {
        systemLogger.error("[TEAM_AI_CONFIG_DATA_GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
