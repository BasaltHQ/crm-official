"use server";

import { getSessionAndTeam } from "@/lib/api-utils";
import { normalizeRoleName } from "@/lib/security/authz";
import { dbAdapter } from "@/lib/database/db-adapter";

export async function deleteQuest(questId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) {
            return { success: false, error: "Unauthorized" };
        }

        // Only admins can delete quests
        const role = normalizeRoleName(teamInfo.teamRole);
        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin && !["SUPER_ADMIN", "OWNER", "ADMIN", "PLATFORM_ADMIN"].includes(role)) {
            return { success: false, error: "INSUFFICIENT_PERMISSIONS" };
        }

        const { ObjectId } = require("mongodb");
        if (!questId || !ObjectId.isValid(questId)) {
            return { success: false, error: "Invalid quest ID." };
        }
        const questCollection = await dbAdapter.getNativeCollection("Quest");
        const progressCollection = await dbAdapter.getNativeCollection("QuestProgress");

        // Validate quest exists and belongs to the team
        const questResult = await questCollection.deleteOne({
            _id: new ObjectId(questId),
            team_id: new ObjectId(teamInfo.teamId),
        });

        if (questResult.deletedCount === 0) {
            return { success: false, error: "Quest not found or unauthorized." };
        }

        // Cleanup associated progress
        await progressCollection.deleteMany({
            quest_id: new ObjectId(questId),
        });

        return { success: true };
    } catch (error) {
        console.error("[DELETE_QUEST]", error);
        return { success: false, error: "Failed to delete quest." };
    }
}
