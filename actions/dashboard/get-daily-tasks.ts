"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const getDailyTasks = async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return [];

    // Get start and end of today in local time (server time, but ideally should be user time)
    // For simplicity, we'll check for tasks due "on or before" end of today that are not complete.
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const tasks = await prismadb.tasks.findMany({
        where: {
            user: session.user.id,
            dueDateAt: {
                lte: endOfDay,
            },
            taskStatus: {
                not: "COMPLETE",
            },
        },
        include: {
            assigned_section: {
                select: {
                    board: true, // Needed for linking
                    title: true,
                },
            },
        },
        orderBy: {
            dueDateAt: "asc",
        },
    });

    return tasks;
};
