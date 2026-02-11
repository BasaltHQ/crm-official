"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getAIInsights = async () => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin) return [];

        const insights = [];

        // Insight 1: Stale Leads
        const staleLeads = await prismadb.crm_Leads.findMany({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
                status: "NEW",
                createdAt: {
                    lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
                }
            },
            take: 1,
            orderBy: { createdAt: "desc" }
        });

        if (staleLeads.length > 0) {
            insights.push({
                id: "stale-lead",
                title: "Stale Lead Warning",
                description: `${staleLeads[0].lastName} has been in "NEW" status for 3+ days.`,
                action: "Follow Up",
                actionHref: `/crm/leads/${staleLeads[0].id}`,
                type: "warning"
            });
        }

        // Insight 2: Recent Success in Lead Gen
        const recentJobs = await prismadb.crm_Lead_Gen_Jobs.findMany({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
                status: "SUCCESS",
                finishedAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
                }
            },
            include: { assigned_pool: true },
            take: 1
        });

        if (recentJobs.length > 0) {
            insights.push({
                id: "job-success",
                title: "Discovery Complete",
                description: `AI discovery for "${recentJobs[0].assigned_pool?.name || "Global"}" finished successfully.`,
                action: "View Leads",
                actionHref: "/crm/lead-pools",
                type: "success"
            });
        }

        // Default Insight
        if (insights.length < 2) {
            insights.push({
                id: "optimization",
                title: "Workflow Optimization",
                description: "Your team's email open rate is 15% above average this week.",
                action: "View Stats",
                actionHref: "/reports",
                type: "info"
            });
        }

        return insights;
    } catch (error) {
        console.error("Error fetching AI insights:", error);
        return [];
    }
};
