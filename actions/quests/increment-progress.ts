// Server-side Quest progress tracking engine (NOT a client-callable Server Action)
import { dbAdapter } from "@/lib/database/db-adapter";

/**
 * Core progress tracking engine.
 * Called from CRM action hooks (fire-and-forget).
 * Finds active quests matching the quest_type for this team and user,
 * increments progress, and triggers reward awarding on completion.
 */
export async function incrementQuestProgress(params: {
    userId: string;
    teamId: string;
    questType: string;
    incrementBy?: number;
    fieldValue?: number;
}): Promise<void> {
    try {
        const { ObjectId } = require("mongodb");
        if (!params?.userId || !ObjectId.isValid(params.userId) || !params?.teamId || !ObjectId.isValid(params.teamId)) {
            return;
        }
        const questCollection = await dbAdapter.getNativeCollection("Quest");
        const progressCollection = await dbAdapter.getNativeCollection("QuestProgress");

        const now = new Date();

        // Find all active quests matching this type for this team within valid date range
        const activeQuests = await questCollection
            .find({
                team_id: new ObjectId(params.teamId),
                quest_type: String(params.questType || ""),
                status: "ACTIVE",
                $and: [
                    { $or: [{ starts_at: null }, { starts_at: { $lte: now } }] },
                    { $or: [{ ends_at: null }, { ends_at: { $gte: now } }] },
                ],
            })
            .toArray();

        if (activeQuests.length === 0) return;

        const increment = Math.max(1, Math.min(Math.floor(Number(params.incrementBy) || 1), 1000));

        for (const quest of activeQuests) {
            // Check if user is enrolled
            const isEnrolled =
                quest.is_team_wide ||
                (quest.assigned_users || []).some(
                    (uid: any) => uid.toString() === params.userId
                );

            if (!isEnrolled) continue;

            // Upsert progress
            const existing = await progressCollection.findOne({
                quest_id: quest._id,
                user_id: new ObjectId(params.userId),
            });

            if (existing?.is_completed) continue; // Already completed

            const newCount = (existing?.current_count || 0) + increment;
            const isNowCompleted = newCount >= quest.target_count;

            if (existing) {
                await progressCollection.updateOne(
                    { _id: existing._id },
                    {
                        $set: {
                            current_count: newCount,
                            is_completed: isNowCompleted,
                            completed_at: isNowCompleted ? now : null,
                            updated_at: now,
                        },
                    }
                );
            } else {
                continue; // User has not accepted this quest yet, do not track!
            }

            // Award rewards on completion
            if (isNowCompleted) {
                try {
                    const { awardQuestRewards } = await import("./award-quest-rewards");
                    await awardQuestRewards({
                        questId: quest._id.toString(),
                        userId: params.userId,
                    });
                } catch (e) {
                    console.error("[QUEST_REWARD_ERROR]", e);
                }
            }
        }
    } catch (error) {
        console.error("[INCREMENT_QUEST_PROGRESS]", error);
        // Never throw — this is fire-and-forget
    }
}
