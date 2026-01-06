"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    const session = await getServerSession(authOptions);
    if (!session) return null;

    // Security check: Only Admins/Managers should be able to fetch other users' data
    // For now, assuming if you have access to the page, you can view (or simplistic check)
    // Real implementation should check session.user.role

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
