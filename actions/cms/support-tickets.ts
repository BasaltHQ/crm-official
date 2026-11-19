"use server";

import { prismadb } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/security/authz";

export async function getSupportTickets(limit = 20) {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) return [];

        const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
        // @ts-ignore
        const tickets = await prismadb.supportTicket.findMany({
            take: safeLimit,
            orderBy: {
                createdAt: "desc",
            }
        });
        return tickets;
    } catch (error) {
        console.error("Failed to fetch support tickets:", error);
        return [];
    }
}
