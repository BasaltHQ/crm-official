"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { buildUserContext, canManageDepartment } from "@/lib/department-permissions";

export interface UpdateDepartmentInput {
    departmentId: string;
    name?: string;
    description?: string;
}

export interface UpdateDepartmentResult {
    success: boolean;
    department?: {
        id: string;
        name: string;
        slug: string;
    };
    error?: string;
}

/**
 * Update a department's details
 * SUPER_ADMIN can update any department
 * ADMIN can only update their own department
 */
export async function updateDepartment(data: UpdateDepartmentInput): Promise<UpdateDepartmentResult> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            include: { assigned_team: true },
        });

        if (!user?.team_id) {
            return { success: false, error: "User is not part of a team" };
        }

        const userContext = buildUserContext(user as any);

        // Check permission
        if (!canManageDepartment(userContext, data.departmentId)) {
            return { success: false, error: "You don't have permission to update this department" };
        }

        // Verify department exists and belongs to the same org
        const department = await prismadb.team.findFirst({
            where: {
                id: data.departmentId,
                team_type: "DEPARTMENT",
                parent_id: user.team_id,
            },
        });

        if (!department) {
            return { success: false, error: "Department not found" };
        }

        // Build update data
        const updateData: { name?: string } = {};

        if (data.name && data.name !== department.name) {
            updateData.name = data.name;
        }

        if (Object.keys(updateData).length === 0) {
            return {
                success: true,
                department: {
                    id: department.id,
                    name: department.name,
                    slug: department.slug,
                },
            };
        }

        // Update the department
        const updated = await prismadb.team.update({
            where: { id: data.departmentId },
            data: updateData,
        });

        revalidatePath("/partners");
        revalidatePath(`/partners/${user.team_id}`);
        revalidatePath("/partners/users");
        revalidatePath(`/partners/${session.user.id}`);
        revalidatePath("/admin");
        revalidatePath("/admin/modules");

        return {
            success: true,
            department: {
                id: updated.id,
                name: updated.name,
                slug: updated.slug,
            },
        };
    } catch (error) {
        console.error("Error updating department:", error);
        return { success: false, error: "Failed to update department" };
    }
}
