"use server";

import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { requirePlatformAdmin } from "@/lib/security/authz";

export async function getAllSubscriptions() {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) return [];

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
        systemLogger.error("[GET_ALL_SUBSCRIPTIONS]", error);
        return [];
    }
}
