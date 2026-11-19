"use server";

import { getSessionAndTeam } from "@/lib/api-utils";
import { dbAdapter } from "@/lib/database/db-adapter";

export async function acceptQuest(questId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) {
            return { success: false, error: "Unauthorized" };
        }
        const userId = session.user.id;

        const { ObjectId } = require("mongodb");
        if (!questId || !ObjectId.isValid(questId)) {
            return { success: false, error: "Invalid quest ID." };
        }
        const questCollection = await dbAdapter.getNativeCollection("Quest");
        const progressCollection = await dbAdapter.getNativeCollection("QuestProgress");

        // Validate quest exists and belongs to the team
        const quest = await questCollection.findOne({
            _id: new ObjectId(questId),
            team_id: new ObjectId(teamInfo.teamId),
            status: "ACTIVE",
        });

        if (!quest) {
            return { success: false, error: "Active quest not found." };
        }

        // Verify eligibility
        const isEnrolled = quest.is_team_wide || (quest.assigned_users || []).some((uid: any) => uid.toString() === userId);
        if (!isEnrolled) {
            return { success: false, error: "You are not eligible for this quest." };
        }

        // Insert empty progress state
        await progressCollection.updateOne(
            { quest_id: new ObjectId(questId), user_id: new ObjectId(userId) },
            {
                $setOnInsert: {
                    quest_id: new ObjectId(questId),
                    user_id: new ObjectId(userId),
                    current_count: 0,
                    is_completed: false,
                    completed_at: null,
                    qp_awarded: 0,
                    xp_awarded: 0,
                    bonuses_applied: null,
                    started_at: new Date(),
                    updated_at: new Date(),
                }
            },
            { upsert: true }
        );

        return { success: true };
    } catch (error) {
        console.error("[ACCEPT_QUEST]", error);
        return { success: false, error: "Failed to accept quest." };
    }
}
