// Server-side Quest reward utility module (NOT a client-callable Server Action)
import { dbAdapter } from "@/lib/database/db-adapter";
import { calculateXPAward, computeLevelFromXP } from "@/lib/quest-engine/xp-curve";
import { checkAndAwardBadges, type AchievementCheckStats } from "@/lib/quest-engine/badge-engine";

/**
 * Awards Quest Points (QP) and XP when a quest is completed.
 * Calculates bonus multipliers: Early Bird, Overachiever, Streak.
 * Triggers level-up detection and badge checks.
 */
export async function awardQuestRewards(params: {
    questId: string;
    userId: string;
}): Promise<{
    baseQP: number;
    bonuses: Record<string, number>;
    totalQP: number;
    xpAwarded: number;
    levelUp: boolean;
    newLevel: number;
    newBadges: string[];
} | null> {
    try {
        const { ObjectId } = require("mongodb");
        if (!params?.questId || !ObjectId.isValid(params.questId) || !params?.userId || !ObjectId.isValid(params.userId)) {
            return null;
        }
        const questCollection = await dbAdapter.getNativeCollection("Quest");
        const progressCollection = await dbAdapter.getNativeCollection("QuestProgress");
        const usersCollection = await dbAdapter.getNativeCollection("Users");

        const quest = await questCollection.findOne({ _id: new ObjectId(params.questId) });
        if (!quest) return null;

        const progress = await progressCollection.findOne({
            quest_id: new ObjectId(params.questId),
            user_id: new ObjectId(params.userId),
        });
        if (!progress || !progress.is_completed || progress.qp_awarded > 0) return null; // Not completed or already awarded

        const baseQP = quest.qp_reward || 100;
        const baseXP = quest.xp_reward || 50;
        const bonuses: Record<string, number> = {};

        // Early Bird: completed in first 25% of duration
        let isEarlyBird = false;
        if (quest.starts_at && quest.ends_at && progress.completed_at) {
            const totalDuration = new Date(quest.ends_at).getTime() - new Date(quest.starts_at).getTime();
            const completedIn = new Date(progress.completed_at).getTime() - new Date(quest.starts_at).getTime();
            const ratio = completedIn / totalDuration;
            if (ratio <= 0.25) {
                bonuses.earlyBird = 0.5; // +50%
                isEarlyBird = true;
            } else if (ratio <= 0.5) {
                bonuses.speedDemon = 0.25; // +25%
            }
        }

        // Overachiever: exceeded target by 50%+
        let isOverachiever = false;
        if (progress.current_count >= quest.target_count * 1.5) {
            bonuses.overachiever = 0.3; // +30%
            isOverachiever = true;
        }

        // Streak: check consecutive quests completed
        const user = await usersCollection.findOne({ _id: new ObjectId(params.userId) });
        const currentStreak = (user?.quest_streak || 0) + 1;
        if (currentStreak >= 3) {
            bonuses.streak = 0.2; // +20%
        }

        // Calculate total QP & XP
        const bonusMultiplier = Object.values(bonuses).reduce((sum, b) => sum + b, 0);
        const totalQP = Math.round(baseQP * (1 + bonusMultiplier));
        const totalXP = Math.round(baseXP * (1 + bonusMultiplier));

        // Calculate level-up
        const currentXPTotal = user?.xp_total || 0;
        const currentPrestige = user?.prestige || 0;
        const levelResult = calculateXPAward(currentXPTotal, totalXP, currentPrestige);

        // Atomically claim reward on progress record to prevent duplicate awards
        const claimResult = await progressCollection.updateOne(
            { _id: progress._id, is_completed: true, qp_awarded: { $lte: 0 } },
            {
                $set: {
                    qp_awarded: totalQP,
                    xp_awarded: totalXP,
                    bonuses_applied: bonuses,
                    updated_at: new Date(),
                },
            }
        );
        if (claimResult.modifiedCount === 0) return null;

        // Update user aggregate fields
        const levelState = computeLevelFromXP(levelResult.newXPTotal, currentPrestige);
        await usersCollection.updateOne(
            { _id: new ObjectId(params.userId) },
            {
                $inc: {
                    quest_points_total: totalQP,
                    quest_streak: 1,
                },
                $set: {
                    xp_total: levelResult.newXPTotal,
                    xp_current: levelState.xpCurrent,
                    level: levelState.level,
                    updated_at: new Date(),
                },
            }
        );

        // Gather stats for badge checking
        const completedCount = await progressCollection.countDocuments({
            user_id: new ObjectId(params.userId),
            is_completed: true,
        });

        // Count legendary completions
        const allCompletedQuestIds = await progressCollection
            .find({ user_id: new ObjectId(params.userId), is_completed: true })
            .project({ quest_id: 1 })
            .toArray();
        const legendaryCount = await questCollection.countDocuments({
            _id: { $in: allCompletedQuestIds.map((p: any) => p.quest_id) },
            difficulty: "LEGENDARY",
        });

        // Count early bird / overachiever bonuses
        const earlyBirdCount = await progressCollection.countDocuments({
            user_id: new ObjectId(params.userId),
            "bonuses_applied.earlyBird": { $exists: true },
        });
        const overachieverCount = await progressCollection.countDocuments({
            user_id: new ObjectId(params.userId),
            "bonuses_applied.overachiever": { $exists: true },
        });

        // Count quests created by this user
        const questsCreated = await questCollection.countDocuments({
            created_by: new ObjectId(params.userId),
        });

        // Count current badges
        const badgeCollection = await dbAdapter.getNativeCollection("UserBadge");
        const badgeCount = await badgeCollection.countDocuments({
            user_id: new ObjectId(params.userId),
        });

        const stats: AchievementCheckStats = {
            questsCompleted: completedCount,
            questStreak: currentStreak,
            xpTotal: levelResult.newXPTotal,
            level: levelState.level,
            prestige: currentPrestige,
            questsCreated,
            badgeCount,
            legendaryCompleted: legendaryCount,
            earlyBirdCount: earlyBirdCount + (isEarlyBird ? 1 : 0),
            overachieverCount: overachieverCount + (isOverachiever ? 1 : 0),
        };

        // Check and award all eligible badges
        const newBadges = await checkAndAwardBadges(params.userId, stats);

        // Custom Quest Badge
        if (quest.badge_dna && quest.badge_name) {
            const badgeCollection = await dbAdapter.getNativeCollection("UserBadge");
            const customBadgeId = `quest_custom_${quest._id.toString()}`;
            const existingCustom = await badgeCollection.findOne({ 
                user_id: new ObjectId(params.userId), 
                badge_id: customBadgeId 
            });
            
            if (!existingCustom) {
                await badgeCollection.insertOne({
                    user_id: new ObjectId(params.userId),
                    badge_id: customBadgeId,
                    badge_dna: quest.badge_dna,
                    badge_name: quest.badge_name,
                    category: "quest",
                    rarity: quest.difficulty || "COMMON",
                    awarded_at: new Date(),
                });
                newBadges.push(customBadgeId);
            }
        }

        // Also sync legacy quest_badges array for backward compat
        if (newBadges.length > 0) {
            await usersCollection.updateOne(
                { _id: new ObjectId(params.userId) },
                { $addToSet: { quest_badges: { $each: newBadges } } }
            );
        }

        return {
            baseQP,
            bonuses,
            totalQP,
            xpAwarded: totalXP,
            levelUp: levelResult.levelsGained > 0,
            newLevel: levelState.level,
            newBadges,
        };
    } catch (error) {
        console.error("[AWARD_QUEST_REWARDS]", error);
        return null;
    }
}
