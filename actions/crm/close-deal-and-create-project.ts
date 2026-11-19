"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { prismadbCrm } from "@/lib/prisma-crm";

export type ActionResponse = {
    success: boolean;
    data?: any;
    error?: string;
};

export async function closeDealAndCreateProject(opportunityId: string): Promise<ActionResponse> {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) {
            return { success: false, error: "Unauthorized" };
        }

        const opportunity = await prismadb.crm_Opportunities.findUnique({
            where: { id: opportunityId },
            include: {
                contacts: true,
                assigned_account: true,
            },
        });

        if (!opportunity) {
            return { success: false, error: "Opportunity not found" };
        }

        if (!validateResourceOwnership(teamInfo.teamId, opportunity.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        if (opportunity.status === "CLOSED") {
            return { success: false, error: "Opportunity is already closed won" };
        }

        // Create a new Project (Board)
        const projectTitle = opportunity.name || "New Project";
        const projectDescription = opportunity.description || `Project created from opportunity: ${opportunity.name}`;

        // Trace campaign context via the associated lead
        let brandLogoUrl = undefined;
        let brandPrimaryColor = undefined;
        let meetingLink = undefined;
        let targetIndustries = [];
        let targetGeos = [];
        let targetTitles = [];
        let campaignBrief = undefined;

        if (opportunity.lead_id) {
            try {
                // Find pools that include this lead
                const maps = await (prismadbCrm as any).crm_Lead_Pools_Leads.findMany({
                    where: { lead: opportunity.lead_id },
                    select: { pool: true },
                    orderBy: { createdAt: "desc" },
                });

                for (const m of maps) {
                    if (!m?.pool) continue;
                    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
                        where: { id: m.pool },
                        select: { icpConfig: true },
                    });

                    if (pool?.icpConfig) {
                        const icp = pool.icpConfig as any;
                        if (icp.industries) targetIndustries = icp.industries;
                        if (icp.geos) targetGeos = icp.geos;
                        if (icp.titles) targetTitles = icp.titles;

                        const campaignId = icp.assignedCampaignId as string | undefined;
                        if (campaignId) {
                            const campaign = await (prismadbCrm as any).crm_Outreach_Campaigns.findUnique({
                                where: { id: campaignId },
                                select: { campaign_branding: true, meeting_link: true, description: true },
                            });
                            
                            if (campaign) {
                                if (campaign.campaign_branding) {
                                    const branding = campaign.campaign_branding as any;
                                    brandLogoUrl = branding.logo_url || undefined;
                                    brandPrimaryColor = branding.primary_brand_color || undefined;
                                }
                                meetingLink = campaign.meeting_link || undefined;
                                campaignBrief = campaign.description || undefined;
                                break; // use newest non-empty pool's campaign
                            }
                        }
                        
                        // Fall back to just ICP if no campaign
                        break;
                    }
                }
            } catch (e) {
                systemLogger.error("[PROJECT_TRANSITION_TRACE_ERROR]", e);
            }
        }

        const newProject = await prismadb.boards.create({
            data: {
                v: 0,
                title: projectTitle,
                description: projectDescription,
                visibility: "private",
                status: "ACTIVE", // ProjectStatus enum
                user: session.user.id,
                createdBy: session.user.id,
                updatedBy: session.user.id,
                team_id: opportunity.team_id,

                // Campaign Context preserved
                brand_logo_url: brandLogoUrl,
                brand_primary_color: brandPrimaryColor,
                meeting_link: meetingLink,
                target_industries: targetIndustries,
                target_geos: targetGeos,
                target_titles: targetTitles,
                campaign_brief: campaignBrief,
            },
        });

        const projectId = newProject.id;

        // Create default sections properly formatted for createMany
        const defaultSections = [
            { title: "To Do", position: 0 },
            { title: "In Progress", position: 1 },
            { title: "Done", position: 2 }
        ].map(s => ({
            v: 0,
            board: projectId,
            title: s.title,
            position: s.position
        }));

        // Create sections separately
        await prismadb.sections.createMany({
            data: defaultSections
        });

        // Add creator as Project Member (Lead)
        await prismadb.projectMember.create({
            data: {
                project: projectId,
                user: session.user.id,
                role: "LEAD",
                assignedBy: session.user.id,
            }
        });

        // Update Opportunity
        await prismadb.crm_Opportunities.update({
            where: { id: opportunityId },
            data: {
                status: "CLOSED", // crm_Opportunity_Status enum
                project: projectId,
            },
        });

        revalidatePath(`/crm/opportunities/${opportunityId}`);
        revalidatePath("/projects");

        // Quest progress — fire-and-forget
        if (opportunity.team_id) {
            import("@/actions/quests/increment-progress").then(({ incrementQuestProgress }) => {
                incrementQuestProgress({ userId: session.user.id, teamId: opportunity.team_id!, questType: "close_deals" }).catch(() => { });
            }).catch(() => { });
        }

        import("@/actions/quests/add-raw-xp")
          .then((m) => m.addRawXP({ userId: session.user.id, xpAmount: 50, reason: "Closed Opportunity (Won)" }))
          .catch((e) => systemLogger.warn(`[CLOSE_DEAL_GAMIFICATION] Failed to award XP: ${e?.message}`));

        return {
            success: true,
            data: { projectId }
        };

    } catch (error: any) {
        systemLogger.error("[CLOSE_DEAL]", error);
        return { success: false, error: error.message || "Failed to close deal" };
    }
}
