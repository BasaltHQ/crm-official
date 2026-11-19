"use server";

import { prismadb } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/security/authz";

export async function getActiveUsers() {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) return [];

        const users = await prismadb.users.findMany({
            orderBy: {
                lastLoginAt: "desc",
            },
            take: 20,
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                lastLoginAt: true,
                is_admin: true,
            },
        });

        return users;
    } catch (error) {
        console.error("Failed to fetch active users", error);
        return [];
    }
}
