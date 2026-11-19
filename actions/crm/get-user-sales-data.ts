"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { getLeadsStageCounts } from "@/actions/dashboard/get-leads-stage-counts";
import { getTeamAnalytics } from "@/actions/dashboard/get-team-analytics";

export type UserSpecificSalesData = {
    pipeline: {
        counts: Record<string, number>;
        total: number;
    };
    rank: number | null;
    score: number;
    meta: {
        userId: string;
        userName: string;
    }
};

export const getUserSalesData = async (targetUserId: string): Promise<UserSpecificSalesData | null> => {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error || !session?.user?.id || !teamInfo?.teamId || !targetUserId) return null;

    if (targetUserId !== session.user.id) {
        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
            return null;
        }
        const targetUser = await prismadb.users.findUnique({
            where: { id: targetUserId },
            select: { id: true, team_id: true },
        });
        if (!targetUser || !validateResourceOwnership(teamInfo.teamId, targetUser.team_id, teamInfo.isPlatformAdmin)) {
            return null;
        }
    }

    const [userStageCounts, teamAnalytics] = await Promise.all([
        getLeadsStageCounts(targetUserId),
        getTeamAnalytics(),
    ]);

    // Derive User Rank & Score
    const myLeaderboardEntry = teamAnalytics.leaderboard.find(u => u.userId === targetUserId);
    const myRank = myLeaderboardEntry ? teamAnalytics.leaderboard.indexOf(myLeaderboardEntry) + 1 : null;
    const myScore = myLeaderboardEntry?.points || 0;
    const userName = myLeaderboardEntry?.name || "Unknown User";

    return {
        pipeline: {
            counts: userStageCounts.overall.counts.byStage,
            total: userStageCounts.overall.counts.total,
        },
        rank: myRank,
        score: myScore,
        meta: {
            userId: targetUserId,
            userName,
        }
    };
};
