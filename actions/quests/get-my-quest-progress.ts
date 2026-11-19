"use server";

import { getSessionAndTeam } from "@/lib/api-utils";
import { dbAdapter } from "@/lib/database/db-adapter";
import { computeLevelFromXP, getPrestigeTitle } from "@/lib/quest-engine/xp-curve";

/**
 * Gets the current user's quest stats summary including XP, Level, and Badges.
 */
export async function getMyQuestProgress(): Promise<{
    totalQP: number;
    seasonQP: number;
    questsCompleted: number;
    activeQuests: number;
    streak: number;
    badges: string[];
    rank: number;
    // XP/Level fields
    xpTotal: number;
    xpCurrent: number;
    xpToNext: number;
    level: number;
    prestige: number;
    prestigeTitle: string;
    progressPct: number;
    earnedBadges: Array<{
        badge_id: string;
        badge_dna: any;
        badge_name: string;
        category: string;
        rarity: string;
        awarded_at: string;
    }>;
    showcaseBadge: {
        badge_id: string;
        badge_dna: any;
        badge_name: string;
        category: string;
        rarity: string;
        awarded_at: string;
    } | null;
} | null> {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) return null;
        const userId = session.user.id;

        const { ObjectId } = require("mongodb");
        const usersCollection = await dbAdapter.getNativeCollection("Users");
        const progressCollection = await dbAdapter.getNativeCollection("QuestProgress");
        const questCollection = await dbAdapter.getNativeCollection("Quest");
        const badgeCollection = await dbAdapter.getNativeCollection("UserBadge");

        const user = await usersCollection.findOne({
            _id: new ObjectId(userId),
        });
        if (!user) return null;

        // Count completed quests
        const teamQuestIds = await questCollection
            .find({ team_id: new ObjectId(teamInfo.teamId) })
            .project({ _id: 1 })
            .toArray();

        const completedCount = await progressCollection.countDocuments({
            quest_id: { $in: teamQuestIds.map((q: any) => q._id) },
            user_id: new ObjectId(userId),
            is_completed: true,
        });

        const activeCount = await progressCollection.countDocuments({
            quest_id: { $in: teamQuestIds.map((q: any) => q._id) },
            user_id: new ObjectId(userId),
            is_completed: false,
        });

        // Calculate rank
        const allMembers = await usersCollection
            .find({
                team_id: new ObjectId(teamInfo.teamId),
                userStatus: "ACTIVE",
            })
            .project({ _id: 1, quest_points_total: 1 })
            .sort({ quest_points_total: -1 })
            .toArray();

        const rank = allMembers.findIndex((m: any) => m._id.toString() === userId) + 1;

        // Compute level state
        const xpTotal = user.xp_total || 0;
        const prestige = user.prestige || 0;
        const levelState = computeLevelFromXP(xpTotal, prestige);
        const prestigeTitle = user.prestige_title || getPrestigeTitle(prestige);

        // Fetch earned badges
        const rawBadges = await badgeCollection
            .find({ user_id: new ObjectId(userId) })
            .sort({ awarded_at: -1 })
            .toArray();

        const earnedBadges = rawBadges.map((b: any) => ({
            badge_id: b.badge_id,
            badge_dna: b.badge_dna,
            badge_name: b.badge_name,
            category: b.category,
            rarity: b.rarity,
            awarded_at: b.awarded_at?.toISOString() || new Date().toISOString(),
        }));

        // Showcase badge
        let showcaseBadge = null;
        if (user.showcase_badge_id) {
            const showcase = rawBadges.find((b: any) => b._id.toString() === user.showcase_badge_id);
            if (showcase) {
                showcaseBadge = {
                    badge_id: showcase.badge_id,
                    badge_dna: showcase.badge_dna,
                    badge_name: showcase.badge_name,
                    category: showcase.category,
                    rarity: showcase.rarity,
                    awarded_at: showcase.awarded_at?.toISOString() || new Date().toISOString(),
                };
            }
        }

        return {
            totalQP: user.quest_points_total || 0,
            seasonQP: user.quest_points_season || 0,
            questsCompleted: completedCount,
            activeQuests: activeCount,
            streak: user.quest_streak || 0,
            badges: user.quest_badges || [],
            rank: rank || 1,
            xpTotal,
            xpCurrent: levelState.xpCurrent,
            xpToNext: levelState.xpToNext,
            level: levelState.level,
            prestige,
            prestigeTitle,
            progressPct: levelState.progressPct,
            earnedBadges,
            showcaseBadge,
        };
    } catch (error) {
        console.error("[GET_MY_QUEST_PROGRESS]", error);
        return null;
    }
}
