"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { startOfMonth, endOfMonth, differenceInDays } from "date-fns";

export const getRevenuePacing = async () => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin) return null;

        const now = new Date();
        const start = startOfMonth(now);
        const end = endOfMonth(now);
        const daysInMonth = differenceInDays(end, start) + 1;
        const currentDay = differenceInDays(now, start) + 1;
        const daysRemaining = daysInMonth - currentDay;

        // Fetch current month's revenue (from opportunities closed/active in this month)
        // For pacing, let's look at Expected Revenue of ACTIVE opportunities
        const opportunities = await prismadb.crm_Opportunities.findMany({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
                status: "ACTIVE",
                createdAt: {
                    gte: start,
                    lte: end
                }
            },
            select: {
                expected_revenue: true
            }
        });

        const currentRevenue = opportunities.reduce((sum, opp) => sum + (opp.expected_revenue || 0), 0);

        // Mock target: $500,000 per month
        const targetRevenue = 500000;

        // Projection logic: Linear extrapolation
        const projectedEOM = currentDay > 0 ? (currentRevenue / currentDay) * daysInMonth : 0;

        return {
            currentRevenue,
            targetRevenue,
            projectedEOM,
            daysRemaining,
            progress: targetRevenue > 0 ? (currentRevenue / targetRevenue) * 100 : 0
        };
    } catch (error) {
        console.error("Error fetching revenue pacing:", error);
        return null;
    }
};
