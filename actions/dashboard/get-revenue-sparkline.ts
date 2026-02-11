"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { subDays, startOfDay, format } from "date-fns";

export const getRevenueSparkline = async () => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        const teamId = teamInfo?.teamId;
        const isGlobalAdmin = teamInfo?.isGlobalAdmin;

        if (!teamId && !isGlobalAdmin) return [];

        const thirtyDaysAgo = subDays(new Date(), 30);

        // Fetch opportunities created in the last 30 days
        const opportunities = await prismadb.crm_Opportunities.findMany({
            where: {
                ...(isGlobalAdmin ? {} : { team_id: teamId }),
                createdAt: {
                    gte: thirtyDaysAgo
                },
                status: "ACTIVE"
            },
            select: {
                createdAt: true,
                expected_revenue: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        // Group by day
        const dailyData: Record<string, number> = {};

        // Initialize last 30 days with 0
        for (let i = 0; i <= 30; i++) {
            const date = format(subDays(new Date(), 30 - i), 'yyyy-MM-dd');
            dailyData[date] = 0;
        }

        opportunities.forEach(opp => {
            if (opp.createdAt) {
                const date = format(opp.createdAt, 'yyyy-MM-dd');
                if (dailyData[date] !== undefined) {
                    dailyData[date] += opp.expected_revenue || 0;
                }
            }
        });

        // Convert to array of values for sparkline
        return Object.values(dailyData);
    } catch (error) {
        console.error("Error fetching revenue sparkline:", error);
        return [];
    }
};
