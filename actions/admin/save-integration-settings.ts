
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { revalidatePath } from "next/cache";

export async function saveIntegrationSettings(data: FormData) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return { error: "Unauthorized" };
        }

        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.isAdmin) {
            return { error: "Forbidden" };
        }

        const teamId = teamInfo.teamId;
        if (!teamId) return { error: "No team context" };

        // Extract Surge Settings
        const surgeEnabled = data.get("surge_enabled") === "on";
        const surgeApiKey = data.get("surge_api_key") as string;
        const surgeMerchantId = data.get("surge_merchant_id") as string;

        // Extract Mercury Settings
        const mercuryEnabled = data.get("mercury_enabled") === "on";
        const mercuryApiKey = data.get("mercury_api_key") as string;
        const mercuryAccountId = data.get("mercury_account_id") as string;

        // Validate
        if (surgeEnabled && (!surgeApiKey || !surgeMerchantId)) {
            return { error: "Surge API Key and ID are required when enabled." };
        }

        console.log(`[Integrations] Saving for team ${teamId}`);

        // Update or Create
        await prismadb.tenant_Integrations.upsert({
            where: { tenant_id: teamId },
            create: {
                tenant_id: teamId,
                surge_enabled: surgeEnabled,
                surge_api_key: surgeApiKey,
                surge_merchant_id: surgeMerchantId,
                mercury_enabled: mercuryEnabled,
                mercury_api_key: mercuryApiKey,
                mercury_account_id: mercuryAccountId,
                preferred_chain: "BASE"
            },
            update: {
                surge_enabled: surgeEnabled,
                surge_api_key: surgeApiKey,
                surge_merchant_id: surgeMerchantId,
                mercury_enabled: mercuryEnabled,
                mercury_api_key: mercuryApiKey,
                mercury_account_id: mercuryAccountId,
            }
        });

        revalidatePath("/admin/integrations");
        return { success: true };

    } catch (error) {
        console.error("[SaveIntegrations] Error:", error);
        return { error: "Failed to save settings." };
    }
}
