"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin, sanitizeUser } from "@/lib/security/authz";
import { hashPassword } from "@/lib/password-utils";

const VALID_USER_STATUSES = new Set(["ACTIVE", "INACTIVE", "PENDING"]);

export async function getUsers(query?: string) {
    const admin = await requirePlatformAdmin();
    if (!admin) return [];

    const where: any = {};
    if (query && typeof query === "string" && query.trim()) {
        const q = query.trim();
        where.OR = [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
        ];
    }

    const users = await prismadb.users.findMany({
        where,
        include: {
            assigned_role: true,
        },
        orderBy: { created_on: "desc" },
    });

    return sanitizeUser(users);
}

export async function getRoles() {
    const admin = await requirePlatformAdmin();
    if (!admin) return [];

    const roles = await prismadb.role.findMany({
        orderBy: { name: "asc" },
    });

    if (roles.length === 0) {
        await prismadb.role.createMany({
            data: [
                {
                    name: "Admin",
                    permissions: ["cms.access", "users.manage", "settings.manage", "content.manage"],
                    description: "Full access to all system features.",
                },
                {
                    name: "Editor",
                    permissions: ["cms.access", "content.manage"],
                    description: "Can manage content but not system settings.",
                },
                {
                    name: "Viewer",
                    permissions: ["cms.access"],
                    description: "Read-only access.",
                },
            ],
        });
        return await prismadb.role.findMany({ orderBy: { name: "asc" } });
    }

    return roles;
}

export async function upsertUser(data: any) {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { success: false, error: "Forbidden" };
        }

        if (!data || typeof data !== "object") {
            return { success: false, error: "Invalid payload" };
        }

        const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : undefined;

        // Strictly whitelist editable fields
        const safeData: Record<string, any> = {};

        if (typeof data.name === "string") {
            safeData.name = data.name.trim();
        }
        if (typeof data.email === "string" && data.email.trim()) {
            safeData.email = data.email.trim().toLowerCase();
        }
        if (data.roleId === null || typeof data.roleId === "string") {
            safeData.roleId = data.roleId || null;
        }
        if (typeof data.userStatus === "string" && VALID_USER_STATUSES.has(data.userStatus)) {
            safeData.userStatus = data.userStatus;
        }
        if (data.avatar === null || typeof data.avatar === "string") {
            safeData.avatar = data.avatar;
        }
        if (typeof data.is_admin === "boolean") {
            safeData.is_admin = data.is_admin;
        }

        if (typeof data.password === "string" && data.password.length > 0) {
            if (data.password.length < 15 || data.password.length > 128) {
                return { success: false, error: "Password must be between 15 and 128 characters" };
            }
            safeData.password = await hashPassword(data.password);
        }

        if (!id) {
            if (!safeData.email) {
                return { success: false, error: "Email is required" };
            }
            const existing = await prismadb.users.findFirst({
                where: { email: { equals: safeData.email, mode: "insensitive" } },
                select: { id: true },
            });
            if (existing) {
                return { success: false, error: "Email already exists" };
            }

            await prismadb.users.create({
                data: {
                    ...safeData,
                    created_on: new Date(),
                    userStatus: safeData.userStatus || "ACTIVE",
                    is_admin: typeof safeData.is_admin === "boolean" ? safeData.is_admin : false,
                } as any,
            });
        } else {
            if (
                safeData.password ||
                safeData.roleId !== undefined ||
                safeData.is_admin !== undefined ||
                (safeData.userStatus && safeData.userStatus !== "ACTIVE")
            ) {
                safeData.session_version = { increment: 1 };
            }

            await prismadb.users.update({
                where: { id },
                data: safeData,
            });
        }

        revalidatePath("/cms/settings/team");
        return { success: true };
    } catch (error: any) {
        console.error("Failed to upsert user:", error);
        return { success: false, error: "Failed to save user" };
    }
}

export async function deleteUser(id: string) {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { success: false, error: "Forbidden" };
        }

        await prismadb.users.delete({ where: { id } });
        revalidatePath("/cms/settings/team");
        return { success: true };
    } catch {
        return { success: false, error: "Failed to delete user. They may have active records." };
    }
}

export async function toggleUserStatus(id: string, status: "ACTIVE" | "INACTIVE" | "PENDING") {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { success: false, error: "Forbidden" };
        }

        if (!VALID_USER_STATUSES.has(status)) {
            return { success: false, error: "Invalid status" };
        }

        await prismadb.users.update({
            where: { id },
            data: {
                userStatus: status,
                ...(status !== "ACTIVE" ? { session_version: { increment: 1 } } : {}),
            },
        });
        revalidatePath("/cms/settings/team");
        return { success: true };
    } catch {
        return { success: false, error: "Failed to update status" };
    }
}
