"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/security/authz";

export async function updateTeamStatus(
    teamId: string,
    status: "ACTIVE" | "PENDING" | "SUSPENDED",
    reason?: string
) {
    const admin = await requirePlatformAdmin();
    if (!admin) {
        return { error: "Unauthorized: Platform Admin required." };
    }

    try {
        await prismadb.team.update({
            where: { id: teamId },
            data: {
                status: status,
                suspension_reason: status === "SUSPENDED" ? reason : null
            }
        });

        revalidatePath("/partners");
        revalidatePath(`/partners/${teamId}`);
        return { success: `Team status updated to ${status}` };
    } catch (error) {
        console.error("Update Team Status Error:", error);
        return { error: "Failed to update team status" };
    }
}
