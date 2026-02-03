"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { buildUserContext, canCreateDepartment } from "@/lib/department-permissions";

export interface CreateDepartmentInput {
    name: string;
    description?: string;
    parentId?: string;
}

export interface CreateDepartmentResult {
    success: boolean;
    department?: {
        id: string;
        name: string;
        slug: string;
    };
    error?: string;
}

/**
 * Create a new department under a specific organization
 * Super Admins of the org or Global Admins can create departments
 */
export async function createDepartment(data: CreateDepartmentInput): Promise<CreateDepartmentResult> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            include: { assigned_team: true },
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        // Determine target team ID
        const targetTeamId = data.parentId || user.team_id;

        if (!targetTeamId) {
            return { success: false, error: "No target team specified" };
        }

        // Get target team details
        const targetTeam = await prismadb.team.findUnique({
            where: { id: targetTeamId }
        });

        if (!targetTeam) {
            return { success: false, error: "Target team not found" };
        }

        // Check Permissions:
        // 1. Global Admin (user.is_admin)
        // 2. Super Admin of the target team
        const isGlobalAdmin = user.is_admin;
        const isTargetTeamSuperAdmin = user.team_id === targetTeamId &&
            (user.team_role === 'SUPER_ADMIN' || user.team_role === 'OWNER');

        if (!isGlobalAdmin && !isTargetTeamSuperAdmin) {
            return { success: false, error: "Only Team Super Admins or Global Admins can create departments" };
        }

        // Verify parent team is an ORGANIZATION type
        if (targetTeam.team_type !== "ORGANIZATION") {
            return { success: false, error: "Departments can only be created under an organization" };
        }

        // Generate unique slug from name
        const baseSlug = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        const slug = `${targetTeam.slug}-${baseSlug}`;

        // Check for duplicate slug
        const existing = await prismadb.team.findUnique({
            where: { slug },
        });

        if (existing) {
            return { success: false, error: "A department with this name already exists" };
        }

        // Create the department
        const department = await prismadb.team.create({
            data: {
                name: data.name,
                slug,
                team_type: "DEPARTMENT",
                parent_id: targetTeamId,
                owner_id: user.id,
            },
        });

        // ------------------------------------------------------------------
        // Seed Permission Strategy:
        // We fetch the Organization's "Department Template" (scope=DEPARTMENT) 
        // to determine what modules new departments should start with.
        // ------------------------------------------------------------------
        const [orgDeptAdminConfig, orgDeptMemberConfig] = await Promise.all([
            // Fetch configuration for Department Admin set at Org level
            prismadb.rolePermission.findUnique({
                where: {
                    team_id_role_scope: {
                        team_id: targetTeamId,
                        role: 'ADMIN',
                        scope: 'DEPARTMENT'
                    }
                }
            }),
            // Fetch configuration for Department Member set at Org level
            prismadb.rolePermission.findUnique({
                where: {
                    team_id_role_scope: {
                        team_id: targetTeamId,
                        role: 'MEMBER',
                        scope: 'DEPARTMENT'
                    }
                }
            })
        ]);

        // Default modules if Org hasn't configured templates yet
        const defaultAdminModules = ['dashboard', 'accounts', 'contacts', 'leads', 'tasks', 'opportunities', 'projects'];
        const defaultMemberModules = ['dashboard', 'accounts', 'contacts', 'leads', 'tasks'];

        // Use Org's template or fallback to defaults
        const adminModules = orgDeptAdminConfig?.modules ?? defaultAdminModules;
        const memberModules = orgDeptMemberConfig?.modules ?? defaultMemberModules;

        // Create Seeded Role Permissions for this specific Department
        // The scope is still DEPARTMENT, but the team_id is the new Department's ID.
        // This effectively gives the department its own copy of the config to start with.
        // Or should we use scope="ORGANIZATION" relative to the Department?
        // Logic: RolePermission(team_id=DeptID, scope=DEPARTMENT)
        await Promise.all([
            prismadb.rolePermission.create({
                data: {
                    team_id: department.id,
                    role: 'ADMIN',
                    scope: 'DEPARTMENT',
                    modules: adminModules
                }
            }),
            prismadb.rolePermission.create({
                data: {
                    team_id: department.id,
                    role: 'MEMBER',
                    scope: 'DEPARTMENT',
                    modules: memberModules
                }
            })
        ]);

        revalidatePath("/partners");
        revalidatePath("/partners/users"); // Ensure users lists are updated
        revalidatePath(`/partners/${user.team_id}`);
        revalidatePath("/admin"); // Revalidate Admin User Table
        revalidatePath("/admin/modules"); // Revalidate Admin Modules Page

        return {
            success: true,
            department: {
                id: department.id,
                name: department.name,
                slug: department.slug,
            },
        };
    } catch (error) {
        console.error("Error creating department:", error);
        return { success: false, error: "Failed to create department" };
    }
}
