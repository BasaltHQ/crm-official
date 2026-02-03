"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { buildUserContext, canDeleteDepartment } from "@/lib/department-permissions";

export interface DeleteDepartmentResult {
    success: boolean;
    error?: string;
}

/**
 * Delete a department
 * Only SUPER_ADMIN users can delete departments
 * Members of the department will be unassigned (moved back to org-level)
 */
export async function deleteDepartment(departmentId: string): Promise<DeleteDepartmentResult> {
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

        // Check permission - only Super Admin can delete departments
        if (!canDeleteDepartment(userContext)) {
            return { success: false, error: "Only Super Admins can delete departments" };
        }

        // Verify department exists and belongs to the same org
        const department = await prismadb.team.findFirst({
            where: {
                id: departmentId,
                team_type: "DEPARTMENT",
                parent_id: user.team_id,
            },
            include: {
                _count: {
                    select: { members: true },
                },
            },
        });

        if (!department) {
            return { success: false, error: "Department not found" };
        }

        // Unassign all members from this department (they stay in the org)
        await prismadb.users.updateMany({
            where: { department_id: departmentId },
            data: { department_id: null },
        });

        // Unassign CRM resources from this department
        await Promise.all([
            prismadb.crm_Leads.updateMany({
                where: { assigned_department_id: departmentId },
                data: { assigned_department_id: null },
            }),
            prismadb.crm_Contacts.updateMany({
                where: { assigned_department_id: departmentId },
                data: { assigned_department_id: null },
            }),
            prismadb.crm_Opportunities.updateMany({
                where: { assigned_department_id: departmentId },
                data: { assigned_department_id: null },
            }),
            prismadb.crm_Accounts.updateMany({
                where: { assigned_department_id: departmentId },
                data: { assigned_department_id: null },
            }),
        ]);

        // Delete the department
        await prismadb.team.delete({
            where: { id: departmentId },
        });

        revalidatePath("/partners");
        revalidatePath("/partners");
        revalidatePath("/partners/users");
        revalidatePath(`/partners/${session.user.id}`); // Assuming owner
        revalidatePath("/admin");
        revalidatePath("/admin/modules");

        return { success: true };
    } catch (error) {
        console.error("Error deleting department:", error);
        return { success: false, error: "Failed to delete department" };
    }
}
