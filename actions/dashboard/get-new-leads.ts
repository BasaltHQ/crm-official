"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { startOfWeek } from "date-fns";

export const getNewLeads = async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return [];

    const leads = await prismadb.crm_Leads.findMany({
        where: {
            assigned_to: session.user.id,
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 50,
    });

    return leads;
};
