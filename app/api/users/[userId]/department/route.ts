import { NextResponse } from "next/server";
import { getSessionAndTeam } from "@/lib/api-utils";
import {
    ALLOWED_TENANT_ROLES,
    isPrivilegedSystemRole,
    normalizeRoleName,
    requirePlatformAdmin,
} from "@/lib/security/authz";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

/**
 * PUT /api/users/[userId]/department
 * Assign a user to a department (sets team_id to the department's Team)
 * or move them back to the organization level.
 *
 * Body: { departmentId: string | null, role?: string, organizationId: string }
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return NextResponse.json({ error: "Forbidden: Company admin access required" }, { status: 403 });
        }

        const body = await req.json();
        const { departmentId, role = "MEMBER", organizationId } = body;

        if (!organizationId || typeof organizationId !== "string") {
            return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
        }

        const platformAdmin = await requirePlatformAdmin();
        const isPlatformAdmin = Boolean(platformAdmin);

        // Verify caller owns organizationId
        if (!isPlatformAdmin && teamInfo!.teamId !== organizationId) {
            return NextResponse.json(
                { error: "Forbidden: Organization does not match your active team" },
                { status: 403 }
            );
        }

        const normalizedRole = normalizeRoleName(role);
        if (isPrivilegedSystemRole(normalizedRole)) {
            if (!isPlatformAdmin) {
                return NextResponse.json(
                    { error: "Forbidden: Cannot assign privileged system role" },
                    { status: 403 }
                );
            }
        } else if (!ALLOWED_TENANT_ROLES.has(normalizedRole)) {
            return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }

        const callerRole = normalizeRoleName(teamInfo!.teamRole);
        if (normalizedRole === "OWNER" && !isPlatformAdmin && callerRole !== "OWNER") {
            return NextResponse.json(
                { error: "Forbidden: Only an Owner or Platform Admin can assign OWNER" },
                { status: 403 }
            );
        }

        // Verify targetUser belongs to organizationId (directly or via a child department of organizationId)
        const targetUser = await prismadb.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                team_id: true,
                team_role: true,
                is_admin: true,
                assigned_team: { select: { id: true, parent_id: true } },
            },
        });

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const targetBelongsToOrg =
            targetUser.team_id === organizationId ||
            targetUser.assigned_team?.parent_id === organizationId;

        if (!isPlatformAdmin && !targetBelongsToOrg) {
            return NextResponse.json(
                { error: "Forbidden: Target user does not belong to your organization" },
                { status: 403 }
            );
        }

        if (
            !isPlatformAdmin &&
            (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
        ) {
            return NextResponse.json(
                { error: "Forbidden: Cannot modify a Platform Admin" },
                { status: 403 }
            );
        }

        const tRole = normalizeRoleName(targetUser.team_role);
        const isTargetAdmin =
            targetUser.is_admin ||
            ["ADMIN", "OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN", "SYSADM"].includes(tRole);

        if (departmentId) {
            const dept = await prismadb.team.findUnique({
                where: { id: departmentId },
                select: { id: true, team_type: true, parent_id: true },
            });

            if (!dept || (dept as any).team_type !== "DEPARTMENT" || dept.parent_id !== organizationId) {
                return NextResponse.json(
                    { error: "Invalid department for this organization" },
                    { status: 400 }
                );
            }

            const dataToUpdate: Record<string, any> = {
                department_id: departmentId,
            };

            if (!isTargetAdmin) {
                dataToUpdate.team_id = departmentId;
                dataToUpdate.team_role = normalizedRole;
            } else {
                systemLogger.info(`[USER_DEPT] Target ${userId} is top-level admin (${tRole}); preserving global team_id and role.`);
            }

            const updated = await prismadb.users.update({
                where: { id: userId },
                data: dataToUpdate,
            });

            systemLogger.info(`[USER_DEPT] User ${userId} assigned to dept ${departmentId} with role ${normalizedRole}`);
            return NextResponse.json({ team_id: updated.team_id, team_role: updated.team_role });
        } else {
            const dataToUpdate: Record<string, any> = { department_id: null };

            if (!isTargetAdmin) {
                dataToUpdate.team_id = organizationId;
                dataToUpdate.team_role = "MEMBER";
            } else {
                systemLogger.info(`[USER_DEPT] Target ${userId} is top-level admin (${tRole}); preserving global team_id and role on unassign.`);
            }

            const updated = await prismadb.users.update({
                where: { id: userId },
                data: dataToUpdate,
            });

            systemLogger.info(`[USER_DEPT] User ${userId} moved back to org ${organizationId}`);
            return NextResponse.json({ team_id: updated.team_id, team_role: updated.team_role });
        }
    } catch (error) {
        systemLogger.error("[USER_DEPT_PUT]", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
