// Server-side XP utility module (NOT a client-callable Server Action)
import { dbAdapter } from "@/lib/database/db-adapter";
import { calculateXPAward, computeLevelFromXP } from "@/lib/quest-engine/xp-curve";
import { checkAndAwardBadges, type AchievementCheckStats } from "@/lib/quest-engine/badge-engine";
import { ObjectId } from "mongodb";

const MAX_RAW_XP_AWARD = 500;
const SAFE_FLAG_KEY_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Directly awards raw XP for miscellaneous operational tasks outside of Quests
 * (e.g., using Lead Gen credits, sending emails via First Contact)
 */
export async function addRawXP(params: {
    userId: string;
    xpAmount: number;
    reason?: string;
}): Promise<{
    levelUp: boolean;
    newLevel: number;
    newBadges: string[];
} | null> {
    try {
        if (!params?.userId || !ObjectId.isValid(params.userId)) return null;
        const safeXp = Math.max(0, Math.min(Math.floor(Number(params.xpAmount) || 0), MAX_RAW_XP_AWARD));
        if (safeXp <= 0) return null;

        const usersCollection = await dbAdapter.getNativeCollection("Users");
        const user = await usersCollection.findOne({ _id: new ObjectId(params.userId) });
        if (!user) return null;

        const currentXPTotal = user.xp_total || 0;
        const currentPrestige = user.prestige || 0;
        
        // Calculate new XP bounds
        const levelResult = calculateXPAward(currentXPTotal, safeXp, currentPrestige);
        const levelState = computeLevelFromXP(levelResult.newXPTotal, currentPrestige);

        // Update User Profile
        await usersCollection.updateOne(
            { _id: new ObjectId(params.userId) },
            {
                $set: {
                    xp_total: levelResult.newXPTotal,
                    xp_current: levelState.xpCurrent,
                    level: levelState.level,
                    updated_at: new Date(),
                },
            }
        );

        // Gather stats for badge engine to ensure level achievements trigger
        const progressCollection = await dbAdapter.getNativeCollection("QuestProgress");
        const completedCount = await progressCollection.countDocuments({
            user_id: new ObjectId(params.userId),
            is_completed: true,
        });

        const badgeCollection = await dbAdapter.getNativeCollection("UserBadge");
        const badgeCount = await badgeCollection.countDocuments({
            user_id: new ObjectId(params.userId),
        });

        const stats: AchievementCheckStats = {
            questsCompleted: completedCount,
            questStreak: user.quest_streak || 0,
            xpTotal: levelResult.newXPTotal,
            level: levelState.level,
            prestige: currentPrestige,
            questsCreated: 0, 
            badgeCount,
            legendaryCompleted: 0,
            earlyBirdCount: 0,
            overachieverCount: 0,
        };

        const newBadges = await checkAndAwardBadges(params.userId, stats);

        return {
            levelUp: levelState.level > (user.level || 1),
            newLevel: levelState.level,
            newBadges,
        };
    } catch (e) {
        console.error("[ADD_RAW_XP]", e);
        return null;
    }
}

/**
 * Grants XP only once per user based on a specific flag key.
 * Stores a `gamification_flags` object in the Native MongoDB User document.
 * This prevents users from farming XP by repeatedly saving their profile/signature.
 */
export async function grantOneTimeXP(params: {
    userId: string;
    xpAmount: number;
    flagKey: string;
    reason?: string;
}): Promise<{
    levelUp: boolean;
    newLevel: number;
    newBadges: string[];
} | null> {
    try {
        if (!params?.userId || !ObjectId.isValid(params.userId)) return null;
        if (!params?.flagKey || !SAFE_FLAG_KEY_REGEX.test(params.flagKey)) return null;

        const usersCollection = await dbAdapter.getNativeCollection("Users");
        const userObjectId = new ObjectId(params.userId);

        const flagFieldPath = `xp_flags.${params.flagKey}`;

        // Attempt to atomically set the flag ONLY if it doesn't exist yet
        const updateResult = await usersCollection.updateOne(
            { 
                _id: userObjectId,
                [flagFieldPath]: { $exists: false } 
            },
            {
                $set: { [flagFieldPath]: new Date() }
            }
        );

        // If modifiedCount is 0, the flag already existed, so we abort and grant no XP
        if (updateResult.modifiedCount === 0) {
            return null; // Already granted!
        }

        // Successfully acquired lock, now grant the XP
        return await addRawXP({
            userId: params.userId,
            xpAmount: params.xpAmount,
            reason: params.reason
        });

    } catch (e) {
        console.error("[GRANT_ONE_TIME_XP]", e);
        return null;
    }
}
