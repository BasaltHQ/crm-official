
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
        const surgeMerchantId = data.get("surge_merchant_id") as string; // The ID user provided

        // Validate
        if (surgeEnabled && (!surgeApiKey || !surgeMerchantId)) {
            return { error: "Surge API Key and ID are required when enabled." };
        }

        console.log(`[Integrations] Saving for team ${teamId}`);

        // Update or Create
        // unique key is tenant_id (which is teamId)
        await prismadb.tenant_Integrations.upsert({
            where: { tenant_id: teamId },
            create: {
                tenant_id: teamId,
                surge_enabled: surgeEnabled,
                surge_api_key: surgeApiKey,
                surge_merchant_id: surgeMerchantId,
                preferred_chain: "BASE" // Default
            },
            update: {
                surge_enabled: surgeEnabled,
                surge_api_key: surgeApiKey,
                surge_merchant_id: surgeMerchantId
            }
        });

        revalidatePath("/admin/integrations");
        return { success: true };

    } catch (error) {
        console.error("[SaveIntegrations] Error:", error);
        return { error: "Failed to save settings." };
    }
}
