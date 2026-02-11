"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getLeadGenStats = async () => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin) return null;

        const activeJobs = await prismadb.crm_Lead_Gen_Jobs.findMany({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
                status: "RUNNING"
            },
            include: {
                assigned_pool: {
                    select: { name: true }
                }
            },
            take: 3
        });

        const recentSuccess = await prismadb.crm_Lead_Gen_Jobs.count({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
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
