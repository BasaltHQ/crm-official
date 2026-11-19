"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { normalizeRoleName, requirePlatformAdmin } from "@/lib/security/authz";

/**
 * Moves a member to an existing team with a specified role.
 * STRICTLY for PLATFORM_ADMIN use.
 */
export async function moveMemberToExistingTeam(
    userId: string,
    targetTeamId: string,
    newRole: string
) {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { error: "Unauthorized: Platform Admin required." };
        }

        const normalizedRole = normalizeRoleName(newRole);

        // 1. Verify target user exists
        const targetUser = await (prismadb.users as any).findUnique({
            where: { id: userId },
            select: { id: true, email: true, name: true }
        });

        if (!targetUser) return { error: "User not found." };

        // 2. Verify target team exists
        const targetTeam = await prismadb.team.findUnique({
            where: { id: targetTeamId },
            select: { id: true, name: true }
        });

        if (!targetTeam) return { error: "Target team not found." };

        // 3. Move the user
        await (prismadb.users as any).update({
            where: { id: userId },
            data: {
                team_id: targetTeamId,
                team_role: normalizedRole
            }
        });

        revalidatePath("/partners");
        revalidatePath(`/partners/${targetTeamId}`);

        return {
            success: true,
            message: `Successfully moved ${targetUser.name || targetUser.email} to team "${targetTeam.name}" as ${normalizedRole}.`
        };
    } catch (error) {
        systemLogger.error("[MOVE_MEMBER_TO_EXISTING_TEAM]", error);
        return { error: "Failed to move member to team." };
    }
}
