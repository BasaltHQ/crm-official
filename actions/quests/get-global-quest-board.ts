"use server";

import { getSessionAndTeam } from "@/lib/api-utils";
import { dbAdapter } from "@/lib/database/db-adapter";

/**
 * Global Quest Points leaderboard for Sales Command integration.
 */
export async function getGlobalQuestBoard(): Promise<{
    leaderboard: Array<{
        userId: string;
        name: string;
        email: string;
        avatar?: string;
        questPoints: number;
        questStreak: number;
        questsCompleted: number;
        badges: string[];
        rank: number;
    }>;
    totalActiveQuests: number;
}> {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) {
            return { leaderboard: [], totalActiveQuests: 0 };
        }

        const { ObjectId } = require("mongodb");
        const usersCollection = await dbAdapter.getNativeCollection("Users");
        const questCollection = await dbAdapter.getNativeCollection("Quest");
        const progressCollection = await dbAdapter.getNativeCollection("QuestProgress");

        // Get all team members
        const members = await usersCollection
            .find({
                team_id: new ObjectId(teamInfo.teamId),
                userStatus: "ACTIVE",
            })
            .project({
                _id: 1,
                name: 1,
                email: 1,
                avatar: 1,
                image: 1,
                quest_points_total: 1,
                quest_points_season: 1,
                quest_streak: 1,
                quest_badges: 1,
            })
            .toArray();

        // Get completed quest counts per user
        const questIds = await questCollection
            .find({ team_id: new ObjectId(teamInfo.teamId) })
            .project({ _id: 1 })
            .toArray();

        const completedCounts = await progressCollection
            .aggregate([
                {
                    $match: {
                        quest_id: { $in: questIds.map((q: any) => q._id) },
                        is_completed: true,
                    },
                },
                { $group: { _id: "$user_id", count: { $sum: 1 } } },
            ])
            .toArray();

        const completedMap = new Map(
            completedCounts.map((c: any) => [c._id.toString(), c.count])
        );

        // Active quest count
        const totalActiveQuests = await questCollection.countDocuments({
            team_id: new ObjectId(teamInfo.teamId),
            status: "ACTIVE",
        });

        // Build leaderboard
        const leaderboard = members
            .map((m: any, idx: number) => ({
                userId: m._id.toString(),
                name: m.name || m.email?.split("@")[0] || "Unknown",
                email: m.email || "",
                avatar: m.avatar || m.image || null,
                questPoints: m.quest_points_total || 0,
                questStreak: m.quest_streak || 0,
                questsCompleted: completedMap.get(m._id.toString()) || 0,
                badges: m.quest_badges || [],
                rank: 0,
            }))
            .sort((a: any, b: any) => b.questPoints - a.questPoints)
            .map((entry: any, idx: number) => ({ ...entry, rank: idx + 1 }));

        return { leaderboard, totalActiveQuests };
    } catch (error) {
        console.error("[GET_GLOBAL_QUEST_BOARD]", error);
        return { leaderboard: [], totalActiveQuests: 0 };
    }
}
