"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startOfWeek } from "date-fns";

export const getNewProjects = async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return [];

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start

    const newMemberships = await prismadb.projectMember.findMany({
        where: {
            user: session.user.id,
            assignedAt: {
                gte: weekStart,
            },
        },
        include: {
            board: true,
        },
        orderBy: {
            assignedAt: "desc",
        },
    });

    return newMemberships;
};
