"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startOfWeek } from "date-fns";

export const getNewLeads = async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return [];

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start

    const leads = await prismadb.crm_Leads.findMany({
        where: {
            assigned_to: session.user.id,
            createdAt: {
                gte: weekStart,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return leads;
};
