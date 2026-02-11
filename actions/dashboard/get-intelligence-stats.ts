"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { startOfMonth, subMonths } from "date-fns";

export const getIntelligenceStats = async () => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin) return null;

        const now = new Date();
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // 1. Conversion Rate (Leads created in last 30 days that are now Opportunities or marked Converted)
        const recentLeads = await prismadb.crm_Leads.findMany({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
                createdAt: { gte: thirtyDaysAgo }
            },
            select: { status: true }
        });

        const totalLeads = recentLeads.length;
        const convertedLeads = recentLeads.filter(l => l.status === "CONVERTED" || l.status === "QUALIFIED").length;
        const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

        // 2. Average Deal Size
        const opportunities = await prismadb.crm_Opportunities.aggregate({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
                status: "ACTIVE"
            },
            _avg: {
                expected_revenue: true
            }
        });

        // 3. Response Time (Mock logic for now, using average of 1.2h as baseline)
        // In a real system, we'd compare Lead.createdAt with first OutreachItem.createdAt
        const responseTime = 1.2;

        return {
            conversionRate: Math.round(conversionRate),
            avgDealSize: Math.round(opportunities._avg.expected_revenue || 0),
            responseTime
        };
    } catch (error) {
        console.error("Error fetching intelligence stats:", error);
        return null;
    }
};
