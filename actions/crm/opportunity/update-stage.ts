
"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { logUserMetric } from "@/actions/university/log-user-metric";

export async function updateOpportunitySalesStage(opportunityId: string, salesStageId: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");

        const existing = await prismadb.crm_Opportunities.findUnique({
            where: { id: opportunityId },
            select: { id: true, team_id: true },
        });
        if (!existing) throw new Error("Opportunity not found");
        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            throw new Error("Forbidden");
        }

        await prismadb.crm_Opportunities.update({
            where: { id: opportunityId },
            data: { sales_stage: salesStageId }
        });

        await logUserMetric("opportunity_moved");

        revalidatePath("/crm/opportunities");
        return { success: true };
    } catch (error: any) {
        console.error("[UPDATE_OPPORTUNITY_STAGE]", error);
        return { success: false, error: error.message };
    }
}
