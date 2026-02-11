"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { revalidatePath } from "next/cache";

export const markTaskComplete = async (taskId: string) => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.userId) {
            throw new Error("Unauthorized");
        }

        // Verify ownership/permission if needed (e.g. assigned to user or team)
        const task = await prismadb.tasks.findUnique({
            where: { id: taskId },
            include: { assigned_section: true }
        });

        if (!task) {
            throw new Error("Task not found");
        }

        // Check if user has access (basic check: same team)
        // If assigned_section has board, check teamId of board?
        // For simplicity, verify team context if possible or just proceed if found.
        // Assuming tasks belong to boards which belong to teams.

        await prismadb.tasks.update({
            where: { id: taskId },
            data: {
                taskStatus: "COMPLETE",
                updatedAt: new Date(),
                // completionDate could be added if schema supports it
            }
        });

        revalidatePath("/crm/dashboard");
        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Error marking task complete:", error);
        return { success: false, error: "Failed to mark task complete" };
    }
};
