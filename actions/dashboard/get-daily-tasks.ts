"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getDailyTasks = async () => {
    const teamInfo = await getCurrentUserTeamId();
    if (!teamInfo?.userId) return [];

    const whereClause: any = {
        taskStatus: {
            not: "COMPLETE",
        },
    };

    if (teamInfo.isGlobalAdmin) {
        // No filter for global admin (or filter by nothing)
    } else if (teamInfo.isAdmin) {
        // Admins see all tasks in their team
        whereClause.team_id = teamInfo.teamId;
    } else {
        // Members see their own tasks
        whereClause.user = teamInfo.userId;
    }

    const tasks = await prismadb.tasks.findMany({
        where: whereClause,
        include: {
            assigned_section: {
                select: {
                    board: true, // Needed for linking
                    title: true,
                },
            },
        },
        orderBy: [
            { dueDateAt: "asc" },
            { createdAt: "desc" }
        ],
    });

    // Sort by priority locally if needed, but date is key
    return tasks;
};
