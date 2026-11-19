
"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";

export async function updateLeadPipelineStage(leadId: string, newStage: any) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            return { success: false, error: "Unauthorized" };
        }

        const lead = await prismadb.crm_Leads.findUnique({
            where: { id: leadId },
            select: { id: true, team_id: true },
        });
        if (!lead) {
            return { success: false, error: "Lead not found" };
        }
        if (!validateResourceOwnership(teamInfo.teamId, lead.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        await prismadb.crm_Leads.update({
            where: { id: leadId },
            data: { pipeline_stage: newStage }
        });

        // Trigger contact creation if the new stage is beyond Identify
        import("@/actions/crm/lead-conversions").then((m) => {
            m.ensureContactForLead(leadId).catch((err) => {
                console.error("[PIPELINE_CONTACT_SYNC_ERROR]", err);
            });
        });

        revalidatePath("/crm/leads");
        return { success: true };
    } catch (error) {
        console.error("[UPDATE_LEAD_STAGE_ERROR]", error);
        return { success: false, error: "Internal Server Error" };
    }
}
