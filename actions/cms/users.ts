"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getUsers(query?: string) {
    const where: any = {};
    if (query) {
        where.OR = [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } }
        ];
    }

    const users = await prismadb.users.findMany({
        where,
        include: {
            assigned_role: true
        },
        orderBy: { created_on: 'desc' }
    });

    return users;
}

export async function getRoles() {
    const roles = await prismadb.role.findMany({
        orderBy: { name: 'asc' }
    });

    if (roles.length === 0) {
        // Seed default roles
        await prismadb.role.createMany({
            data: [
                { name: "Admin", permissions: ["cms.access", "users.manage", "settings.manage", "content.manage"], description: "Full access to all system features." },
                { name: "Editor", permissions: ["cms.access", "content.manage"], description: "Can manage content but not system settings." },
                { name: "Viewer", permissions: ["cms.access"], description: "Read-only access." }
            ]
        });
        return await prismadb.role.findMany({ orderBy: { name: 'asc' } });
    }

    return roles;
}

export async function upsertUser(data: any) {
    try {
        const { id, ...updateData } = data;

        // If creating new user, verify email uniqueness
        if (!id) {
            const existing = await prismadb.users.findUnique({ where: { email: updateData.email } });
            if (existing) throw new Error("Email already exists");
        }

        if (id) {
            await prismadb.users.update({
                where: { id },
                data: updateData
            });
        } else {
            await prismadb.users.create({
                data: {
                    ...updateData,
                    created_on: new Date(),
                    userStatus: "ACTIVE", // Default to active for manually created users
                    is_admin: false // Default to false, rely on role
                }
            });
        }

        revalidatePath("/cms/settings/team");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to upsert user:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteUser(id: string) {
    try {
        // Soft delete or hard delete? Prudence suggests soft delete usually, but for now specific request implied management including delete.
        // Let's do hard delete for now as per "delete" request, or check if constraints exist.
        // Users have many relations. Soft delete (status=INACTIVE) is safer.
        // But user explicitly asked for "delete".
        // Let's implement Delete but fallback to Deactivate if relations prevent it?
        // Actually, let's just delete for now and rely on constraints throwing error if needed, or cascading.
        // Safe approach: Update status to INACTIVE (Deactivate) is a separate action.
        // Delete = Hard Delete.

        await prismadb.users.delete({ where: { id } });
        revalidatePath("/cms/settings/team");
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "Failed to delete user. They may have active records." };
    }
}

export async function toggleUserStatus(id: string, status: "ACTIVE" | "INACTIVE" | "PENDING") {
    try {
        await prismadb.users.update({
            where: { id },
            data: { userStatus: status }
        });
        revalidatePath("/cms/settings/team");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to update status" };
    }
}
