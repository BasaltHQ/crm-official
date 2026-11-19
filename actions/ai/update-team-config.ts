
"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { encryptSecret, isMaskedSecret } from "@/lib/encryption";

export const updateTeamAiConfig = async (formData: FormData) => {
    const { error, teamInfo } = await getSessionAndTeam();
    if (error || !teamInfo) {
        throw new Error("Unauthorized");
    }

    if (!teamInfo.isAdmin) {
        throw new Error("Forbidden: Team Admin access required");
    }

    const teamId = formData.get("teamId") as string;
    if (!teamId || !validateResourceOwnership(teamInfo.teamId, teamId, teamInfo.isPlatformAdmin)) {
        throw new Error("Forbidden: Unauthorized team access");
    }

    const provider = formData.get("provider") as string;
    const modelId = formData.get("modelId") as string;
    const useSystemKey = formData.get("useSystemKey") === "system";
    const rawApiKey = formData.get("apiKey");

    // If modelId is empty or "default", set to null to use provider default
    const finalModelId = (modelId === "default" || modelId === "") ? null : modelId;

    const existing = await prismadb.teamAiConfig.findUnique({
        where: { team_id: teamId },
    });

    let resolvedApiKey: string | null = null;
    if (!useSystemKey) {
        if (rawApiKey === null || isMaskedSecret(rawApiKey)) {
            resolvedApiKey = existing?.apiKey ?? null;
        } else {
            const trimmed = String(rawApiKey).trim();
            resolvedApiKey = trimmed === "" ? null : encryptSecret(trimmed);
        }
    }

    await prismadb.teamAiConfig.upsert({
        where: { team_id: teamId },
        create: {
            team_id: teamId,
            provider: provider,
            modelId: finalModelId,
            useSystemKey: useSystemKey,
            apiKey: resolvedApiKey,
        },
        update: {
            provider: provider,
            modelId: finalModelId,
            useSystemKey: useSystemKey,
            apiKey: resolvedApiKey,
        },
    });

    revalidatePath(`/settings/team/${teamId}`);
    revalidatePath(`/settings/team`);
    revalidatePath(`/admin`); // Also revalidate admin dashboard since it's embedded there now
};
