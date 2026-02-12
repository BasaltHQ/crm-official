"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getAllSubscriptions() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return [];

        // Fetching all platform subscriptions
        // Refresh: 2026-02-12-v5 (Internal Path)
        const subs = await prismadb.crm_Subscriptions.findMany({
            include: {
                team: {
                    select: {
                        name: true,
                        slug: true
                    }
                }
            },
            orderBy: {
                updatedAt: "desc"
            }
        });

        return subs;
    } catch (error) {
        console.error("[GET_ALL_SUBSCRIPTIONS]", error);
        return [];
    }
}
