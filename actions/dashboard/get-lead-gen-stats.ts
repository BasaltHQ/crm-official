"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getLeadGenStats = async () => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin) return null;

        const teamFilter = teamInfo.isGlobalAdmin ? {} : { assigned_pool: { team_id: teamInfo.teamId } };

        const activeJobs = await prismadb.crm_Lead_Gen_Jobs.findMany({
            where: {
                ...teamFilter,
                status: "RUNNING"
            },
            include: {
                assigned_pool: {
                    select: {
                        id: true,
                        name: true,
                        icpConfig: true,
                    }
                }
            },
            orderBy: { startedAt: "desc" },
            take: 3
        });

        const recentSuccess = await prismadb.crm_Lead_Gen_Jobs.count({
            where: {
                ...teamFilter,
                status: "SUCCESS",
                finishedAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24h
                }
            }
        });

        return {
            activeJobs,
            recentSuccessCount: recentSuccess
        };
    } catch (error) {
        console.error("Error fetching lead gen stats:", error);
        return null;
    }
};
