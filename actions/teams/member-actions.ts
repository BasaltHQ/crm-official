"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { checkTeamLimit } from "@/lib/subscription";
import { hashPassword } from "@/lib/password-utils";
import {
    ALLOWED_TENANT_ROLES,
    isPrivilegedSystemRole,
    normalizeRoleName,
    requirePlatformAdmin,
} from "@/lib/security/authz";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { systemLogger } from "@/lib/logger";

export const updateMemberRole = async (userId: string, role: string) => {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId || !currentUser.isAdmin) {
            return { error: "Unauthorized" };
        }

        const normalizedRole = normalizeRoleName(role);
        const platformAdmin = await requirePlatformAdmin();
        const isPlatformAdmin = Boolean(platformAdmin);

        if (isPrivilegedSystemRole(normalizedRole)) {
            if (!isPlatformAdmin) {
                return { error: "Unauthorized: Only Platform Admins can assign privileged system roles." };
            }
        } else if (!ALLOWED_TENANT_ROLES.has(normalizedRole)) {
            return { error: "Invalid role." };
        }

        const targetUser = await prismadb.users.findUnique({ where: { id: userId } });
        if (!targetUser) return { error: "User not found" };

        const targetTeam = targetUser.team_id
            ? await prismadb.team.findUnique({ where: { id: targetUser.team_id } })
            : null;
        const isChildDepartment =
            targetTeam?.team_type === "DEPARTMENT" && targetTeam.parent_id === currentUser.teamId;

        if (!isPlatformAdmin && currentUser.teamId !== targetUser.team_id && !isChildDepartment) {
            return { error: "Unauthorized: You do not have permission to modify this user." };
        }

        if (
            !isPlatformAdmin &&
            (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
        ) {
            return { error: "Unauthorized: Cannot modify a Platform Admin." };
        }

        const callerRole = normalizeRoleName(currentUser.teamRole);
        const targetCurrentRole = normalizeRoleName(targetUser.team_role);
        if (
            (normalizedRole === "OWNER" || targetCurrentRole === "OWNER") &&
            !isPlatformAdmin &&
            callerRole !== "OWNER"
        ) {
            return { error: "Unauthorized: Only an Owner or Platform Admin can assign or modify OWNER." };
        }

        const updateData: Record<string, any> = {
            team_role: normalizedRole,
            session_version: { increment: 1 },
        };

        if (isPlatformAdmin && normalizedRole === "PLATFORM_ADMIN") {
            updateData.is_admin = true;
            updateData.is_account_admin = true;
        } else if (isPlatformAdmin && !isPrivilegedSystemRole(normalizedRole)) {
            updateData.is_admin = false;
        }

        await (prismadb.users as any).update({
            where: { id: userId },
            data: updateData,
        });
        revalidatePath(`/partners`);
        return { success: true };
    } catch (error) {
        systemLogger.error("[UPDATE_MEMBER_ROLE]", error);
        return { error: "Failed to update role" };
    }
};

export const removeMember = async (userId: string) => {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId || !currentUser.isAdmin) {
            return { error: "Unauthorized" };
        }

        const targetUser = await prismadb.users.findUnique({ where: { id: userId } });
        if (!targetUser) return { error: "User not found" };

        const platformAdmin = await requirePlatformAdmin();
        const isPlatformAdmin = Boolean(platformAdmin);

        const targetTeam = targetUser.team_id
            ? await prismadb.team.findUnique({ where: { id: targetUser.team_id } })
            : null;
        const isChildDepartment =
            targetTeam?.team_type === "DEPARTMENT" && targetTeam.parent_id === currentUser.teamId;

        if (!isPlatformAdmin && currentUser.teamId !== targetUser.team_id && !isChildDepartment) {
            return { error: "Unauthorized: You do not have permission to modify this user." };
        }

        if (
            !isPlatformAdmin &&
            (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
        ) {
            return { error: "Unauthorized: Cannot remove a Platform Admin." };
        }

        if (
            !isPlatformAdmin &&
            normalizeRoleName(targetUser.team_role) === "OWNER" &&
            normalizeRoleName(currentUser.teamRole) !== "OWNER"
        ) {
            return { error: "Unauthorized: Only an Owner can remove another Owner." };
        }

        await (prismadb.users as any).update({
            where: { id: userId },
            data: {
                team_id: null,
                department_id: null,
                team_role: "MEMBER",
                session_version: { increment: 1 },
            },
        });
        return { success: true };
    } catch (error) {
        systemLogger.error("[REMOVE_MEMBER]", error);
        return { error: "Failed to remove member" };
    }
};

export const searchUsers = async (query: string) => {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId || !currentUser.isAdmin) return [];
        if (!query || typeof query !== "string" || query.trim().length < 2) return [];

        const trimmed = query.trim();
        const whereClause: Record<string, any> = {
            OR: [
                { name: { contains: trimmed, mode: "insensitive" } },
                { email: { contains: trimmed, mode: "insensitive" } },
            ],
        };

        // Never leak or expose users across tenants to non-Platform-Admins
        if (!currentUser.isPlatformAdmin) {
            whereClause.AND = [
                { is_admin: { not: true } },
                {
                    OR: [
                        { team_id: null },
                        ...(currentUser.teamId ? [{ team_id: currentUser.teamId }] : []),
                    ],
                },
            ];
        }

        const users = await (prismadb.users as any).findMany({
            where: whereClause,
            take: 5,
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                team_id: true,
            },
        });
        return users;
    } catch {
        return [];
    }
};

export const addMember = async (teamId: string, userId: string, role: string = "MEMBER") => {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId || !currentUser.isAdmin) {
            return { error: "Unauthorized" };
        }

        const normalizedRole = normalizeRoleName(role);
        const platformAdmin = await requirePlatformAdmin();
        const isPlatformAdmin = Boolean(platformAdmin);

        if (isPrivilegedSystemRole(normalizedRole)) {
            if (!isPlatformAdmin) {
                return { error: "Unauthorized: Only Platform Admins can assign privileged system roles." };
            }
        } else if (!ALLOWED_TENANT_ROLES.has(normalizedRole)) {
            return { error: "Invalid role." };
        }

        const callerRole = normalizeRoleName(currentUser.teamRole);
        if (normalizedRole === "OWNER" && !isPlatformAdmin && callerRole !== "OWNER") {
            return { error: "Unauthorized: Only an Owner or Platform Admin can assign OWNER." };
        }

        const targetTeam = await (prismadb as any).team.findUnique({
            where: { id: teamId },
            include: { assigned_plan: true },
        });
        if (!targetTeam) return { error: "Team not found" };

        if (!isPlatformAdmin) {
            const isDirectAdmin = currentUser.teamId === teamId && currentUser.isAdmin;
            const isParentAdmin = targetTeam.parent_id === currentUser.teamId && currentUser.isAdmin;
            if (!isDirectAdmin && !isParentAdmin) {
                return { error: "Unauthorized: Admin privileges required for this team." };
            }
        }

        const memberCount = await (prismadb.users as any).count({ where: { team_id: teamId } });

        if (!checkTeamLimit(targetTeam, "max_users", memberCount)) {
            return { error: "Team member limit reached. Upgrade your plan." };
        }

        const targetUser = await (prismadb.users as any).findUnique({
            where: { id: userId },
            include: { assigned_team: { select: { id: true, parent_id: true } } },
        });
        if (!targetUser) return { error: "User not found" };

        if (
            !isPlatformAdmin &&
            (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
        ) {
            return { error: "Unauthorized: Cannot reassign a Platform Admin." };
        }

        // Prevent cross-tenant kidnapping: reject if targetUser already belongs to a different organization
        const targetOrgRoot = targetTeam.team_type === "DEPARTMENT" ? targetTeam.parent_id : targetTeam.id;
        const userOrgRoot = targetUser.assigned_team?.parent_id || targetUser.team_id;
        if (targetUser.team_id && userOrgRoot !== targetOrgRoot) {
            return { error: "User already belongs to another organization." };
        }

        const updateData: Record<string, any> = {
            session_version: { increment: 1 },
        };

        const targetNormRole = normalizeRoleName(targetUser.team_role);
        const isTargetTopAdmin =
            targetUser.is_admin ||
            ["OWNER", "SUPER_ADMIN", "ADMIN", "PLATFORM_ADMIN"].includes(targetNormRole);
        const isDepartmentTarget = targetTeam.team_type === "DEPARTMENT";

        if (isDepartmentTarget) {
            updateData.department_id = teamId;
        }

        if (isDepartmentTarget && isTargetTopAdmin && targetUser.team_id === targetTeam.parent_id) {
            // Preserve organization-level team_id and role for org admins assigned to a child department
        } else {
            updateData.team_id = teamId;
            updateData.team_role = normalizedRole;
        }

        await (prismadb.users as any).update({
            where: { id: userId },
            data: updateData,
        });
        revalidatePath(`/partners/${teamId}`);
        return { success: true };
    } catch {
        return { error: "Failed to add member" };
    }
};

export const changePassword = async (userId: string, newPassword: string) => {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId || !currentUser.isAdmin) {
            return { error: "Unauthorized" };
        }

        if (typeof newPassword !== "string" || newPassword.length < 15 || newPassword.length > 128) {
            return { error: "Password must be between 15 and 128 characters." };
        }

        const targetUser = await (prismadb.users as any).findUnique({ where: { id: userId } });
        if (!targetUser) return { error: "User not found" };

        const platformAdmin = await requirePlatformAdmin();
        const isPlatformAdmin = Boolean(platformAdmin);

        const isSameTeam = Boolean(currentUser.teamId && currentUser.teamId === targetUser.team_id);

        if (!isPlatformAdmin && (!currentUser.isAdmin || !isSameTeam)) {
            return { error: "Unauthorized: You do not have permission to change this user's password." };
        }

        if (
            !isPlatformAdmin &&
            (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
        ) {
            return { error: "Unauthorized: Cannot change password for a Platform Admin." };
        }

        const hashedPassword = await hashPassword(newPassword);
        await (prismadb.users as any).update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                session_version: { increment: 1 },
            },
        });
        return { success: true };
    } catch (error) {
        systemLogger.error("[CHANGE_PASSWORD]", error);
        return { error: "Failed to update password" };
    }
};

export const resetMemberPassword = changePassword;

export const toggleUserStatus = async (userId: string, status: "ACTIVE" | "INACTIVE") => {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId || !currentUser.isAdmin) {
            return { error: "Unauthorized" };
        }

        if (status !== "ACTIVE" && status !== "INACTIVE") {
            return { error: "Invalid status" };
        }

        const targetUser = await prismadb.users.findUnique({
            where: { id: userId },
            include: { assigned_team: { select: { status: true } } },
        });
        if (!targetUser) return { error: "User not found" };

        const platformAdmin = await requirePlatformAdmin();
        const isPlatformAdmin = Boolean(platformAdmin);

        if (!isPlatformAdmin && currentUser.teamId !== targetUser.team_id) {
            return { error: "Unauthorized: You do not have permission to modify this user." };
        }

        if (
            !isPlatformAdmin &&
            (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
        ) {
            return { error: "Unauthorized: Cannot modify a Platform Admin." };
        }

        if (!isPlatformAdmin && status === "ACTIVE" && targetUser.assigned_team?.status === "PENDING") {
            return { error: "Cannot activate users while team subscription is pending." };
        }

        await (prismadb.users as any).update({
            where: { id: userId },
            data: {
                userStatus: status,
                ...(status === "INACTIVE" ? { session_version: { increment: 1 } } : {}),
            },
        });
        return { success: true };
    } catch (error) {
        systemLogger.error("[TOGGLE_USER_STATUS]", error);
        return { error: "Failed to update status" };
    }
};

export const getOrganizationMembers = async (orgId: string) => {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId) return [];
        if (!currentUser.isPlatformAdmin && currentUser.teamId !== orgId) {
            return [];
        }

        const users = await (prismadb.users as any).findMany({
            where: {
                OR: [
                    { team_id: orgId },
                    { assigned_team: { parent_id: orgId } },
                ],
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
                team_id: true,
                team_role: true,
                assigned_team: {
                    select: {
                        name: true,
                        team_type: true,
                    },
                },
            },
            orderBy: { name: "asc" },
        });
        return users;
    } catch (error) {
        systemLogger.error("[GET_ORG_MEMBERS]", error);
        return [];
    }
};

export const setTeamOwner = async (teamId: string, newOwnerId: string) => {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId) return { error: "Unauthorized" };

        const platformAdmin = await requirePlatformAdmin();
        const isPlatformAdmin = Boolean(platformAdmin);
        const callerRole = normalizeRoleName(currentUser.teamRole);

        if (!isPlatformAdmin && (currentUser.teamId !== teamId || callerRole !== "OWNER")) {
            return { error: "Unauthorized: Only the current Owner or Platform Admin can reassign ownership." };
        }

        const team = await prismadb.team.findUnique({ where: { id: teamId } });
        if (!team) return { error: "Team not found" };

        const targetUser = await prismadb.users.findUnique({ where: { id: newOwnerId } });
        if (!targetUser) return { error: "Target user not found" };

        if (targetUser.team_id !== teamId) {
            return { error: "User must be a member of the team to become its owner." };
        }

        await prismadb.team.update({
            where: { id: teamId },
            data: { owner_id: newOwnerId },
        });

        await prismadb.users.update({
            where: { id: newOwnerId },
            data: {
                team_role: "OWNER",
                session_version: { increment: 1 },
            },
        });

        revalidatePath(`/partners/${teamId}`);
        revalidatePath(`/platform/${teamId}`);
        return { success: true };
    } catch (error) {
        systemLogger.error("[SET_TEAM_OWNER]", error);
        return { error: "Failed to set team owner" };
    }
};
