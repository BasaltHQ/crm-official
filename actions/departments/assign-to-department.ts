"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
    buildUserContext,
    canAssignToDepartment,
    canManageRole
} from "@/lib/department-permissions";
import { TeamRole } from "@/lib/role-permissions";

export interface AssignToDepartmentInput {
    userId: string;
    departmentId: string | null; // null to remove from department
    role?: TeamRole; // optionally change role at the same time
}

export interface AssignToDepartmentResult {
    success: boolean;
    error?: string;
}

/**
 * Assign a user to a department
 * SUPER_ADMIN can assign anyone to any department
 * ADMIN can only assign users to their own department
 */
export async function assignToDepartment(data: AssignToDepartmentInput): Promise<AssignToDepartmentResult> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const actor = await prismadb.users.findUnique({
            where: { id: session.user.id },
            include: { assigned_team: true },
        });

        if (!actor?.team_id) {
            return { success: false, error: "User is not part of a team" };
        }

        const actorContext = buildUserContext(actor as any);

        // If assigning to a department, check permission
        if (data.departmentId && !canAssignToDepartment(actorContext, data.departmentId)) {
            return { success: false, error: "You don't have permission to assign users to this department" };
        }

        // If a role is being set, verify the actor can assign this role
        if (data.role && !canManageRole(actorContext, data.role)) {
            return { success: false, error: `You cannot assign the ${data.role} role` };
        }

        // Verify target user exists and is in the same org
        const targetUser = await prismadb.users.findFirst({
            where: {
                id: data.userId,
                team_id: actor.team_id,
            },
        });

        if (!targetUser) {
            return { success: false, error: "User not found in your organization" };
        }

        // If assigning to a department, verify it exists and belongs to the same org
        if (data.departmentId) {
            const department = await prismadb.team.findFirst({
                where: {
                    id: data.departmentId,
                    team_type: "DEPARTMENT",
                    parent_id: actor.team_id,
                },
            });

            if (!department) {
                return { success: false, error: "Department not found" };
            }
        }

        // Build update data
        const updateData: { department_id?: string | null; team_role?: string } = {
            department_id: data.departmentId,
        };

        if (data.role) {
            updateData.team_role = data.role;
        }

        // Update the user
        await prismadb.users.update({
            where: { id: data.userId },
            data: updateData,
        });

        revalidatePath("/partners");
        revalidatePath(`/partners/${actor.team_id}`);

        return { success: true };
    } catch (error) {
        console.error("Error assigning user to department:", error);
        return { success: false, error: "Failed to assign user to department" };
    }
}

/**
 * Remove a user from their department (back to org-level)
 */
export async function removeFromDepartment(userId: string): Promise<AssignToDepartmentResult> {
    return assignToDepartment({ userId, departmentId: null });
}

/**
 * Bulk assign multiple users to a department
 */
export async function bulkAssignToDepartment(
    userIds: string[],
    departmentId: string
): Promise<{ success: boolean; results: Array<{ userId: string; success: boolean; error?: string }> }> {
    const results = await Promise.all(
        userIds.map(async (userId) => {
            const result = await assignToDepartment({ userId, departmentId });
            return { userId, ...result };
        })
    );

    return {
        success: results.every((r) => r.success),
        results,
    };
}
