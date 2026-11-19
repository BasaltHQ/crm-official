"use server";

import { getSessionAndTeam } from "@/lib/api-utils";
import { normalizeRoleName } from "@/lib/security/authz";
import { dbAdapter } from "@/lib/database/db-adapter";

const ALLOWED_QUEST_STATUSES = new Set(["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"]);

/**
 * Toggle quest status: DRAFT -> ACTIVE, ACTIVE -> COMPLETED, etc.
 * Admin-only action.
 */
export async function toggleQuestStatus(
    questId: string,
    newStatus: "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED"
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) {
            return { success: false, error: "NOT_AUTHENTICATED" };
        }
        const userId = session.user.id;

        if (!ALLOWED_QUEST_STATUSES.has(newStatus)) {
            return { success: false, error: "INVALID_STATUS" };
        }

        const role = normalizeRoleName(teamInfo.teamRole);
        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin && !["SUPER_ADMIN", "OWNER", "ADMIN", "PLATFORM_ADMIN"].includes(role)) {
            return { success: false, error: "INSUFFICIENT_PERMISSIONS" };
        }

        const { ObjectId } = require("mongodb");
        if (!questId || !ObjectId.isValid(questId)) {
            return { success: false, error: "QUEST_NOT_FOUND" };
        }
        const questCollection = await dbAdapter.getNativeCollection("Quest");

        const quest = await questCollection.findOne({
            _id: new ObjectId(questId),
            team_id: new ObjectId(teamInfo.teamId),
        });

        if (!quest) return { success: false, error: "QUEST_NOT_FOUND" };

        // Only the creator or tenant OWNER / platform admin can toggle
        if (quest.created_by.toString() !== userId && !teamInfo.isPlatformAdmin && role !== "SUPER_ADMIN" && role !== "PLATFORM_ADMIN" && role !== "OWNER") {
            return { success: false, error: "INSUFFICIENT_PERMISSIONS" };
        }

        await questCollection.updateOne(
            { _id: new ObjectId(questId), team_id: new ObjectId(teamInfo.teamId) },
            { $set: { status: newStatus, updated_at: new Date() } }
        );

        return { success: true };
    } catch (error) {
        console.error("[TOGGLE_QUEST_STATUS]", error);
        return { success: false, error: "INTERNAL_ERROR" };
    }
}
