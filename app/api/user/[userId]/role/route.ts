import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import {
    ALLOWED_TENANT_ROLES,
    isPrivilegedSystemRole,
    normalizeRoleName,
    requirePlatformAdmin,
} from "@/lib/security/authz";
import { escapeHtml } from "@/lib/security/ssrf-guard";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

export async function PATCH(
    req: Request,
    props: { params: Promise<{ userId: string }> }
) {
    const params = await props.params;
    const { error, teamInfo, session } = await getSessionAndTeam();

    if (error) return error;

    try {
        const body = await req.json();
        const { team_role } = body;

        if (!team_role || typeof team_role !== "string") {
            return new NextResponse("Role is required", { status: 400 });
        }

        const normalizedRole = normalizeRoleName(team_role);
        const platformAdmin = await requirePlatformAdmin();
        const isPlatformAdmin = Boolean(platformAdmin);

        if (isPrivilegedSystemRole(normalizedRole)) {
            if (!isPlatformAdmin) {
                return new NextResponse("Forbidden: Only Platform Admins can assign privileged system roles", {
                    status: 403,
                });
            }
        } else if (!ALLOWED_TENANT_ROLES.has(normalizedRole)) {
            return new NextResponse("Invalid role", { status: 400 });
        }

        const targetUser = await prismadb.users.findUnique({
            where: { id: params.userId },
            select: { id: true, email: true, team_id: true, team_role: true, is_admin: true },
        });

        if (!targetUser) {
            return new NextResponse("User not found", { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, targetUser.team_id, isPlatformAdmin)) {
            return await unauthorizedResponse("UPDATE_ROLE", `Users:${params.userId}`);
        }

        const callerRole = normalizeRoleName(teamInfo!.teamRole);
        const canManageTeamRoles =
            isPlatformAdmin ||
            (teamInfo!.isAdmin && (callerRole === "OWNER" || callerRole === "ADMIN"));

        if (!canManageTeamRoles) {
            return await unauthorizedResponse("UPDATE_ROLE", `Users:${params.userId}`);
        }

        if (
            !isPlatformAdmin &&
            (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
        ) {
            return new NextResponse("Forbidden: Cannot modify a Platform Admin", { status: 403 });
        }

        const targetCurrentRole = normalizeRoleName(targetUser.team_role);
        if (
            (normalizedRole === "OWNER" || targetCurrentRole === "OWNER") &&
            !isPlatformAdmin &&
            callerRole !== "OWNER"
        ) {
            return new NextResponse("Forbidden: Only an Owner or Platform Admin can assign or modify the OWNER role", {
                status: 403,
            });
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

        const user = await prismadb.users.update({
            where: {
                id: params.userId,
            },
            data: updateData,
            select: { email: true, team_role: true },
        });

        await logActivityInternal(
            session!.user.id,
            "ROLE_CHANGE",
            "User Management",
            `Updated role for ${user.email} to ${normalizedRole}`,
            teamInfo!.teamId || undefined
        );

        try {
            const sendEmail = (await import("@/lib/sendmail")).default;
            const safeRole = escapeHtml(normalizedRole);
            await sendEmail({
                to: user.email,
                subject: "Security Alert: Platform Role Changed",
                text: `Your account role has been changed to ${normalizedRole} by an administrator. If you did not expect this, please contact your Security Officer or IT Admin immediately.`,
                html: `
                    <p>Your account role has been changed to <strong>${safeRole}</strong> by an administrator.</p>
                    <p>If you did not expect this, please contact your Security Officer or IT Admin immediately.</p>
                `,
            });
        } catch (emailError) {
            console.error("Failed to send SOC2 role escalation email:", emailError);
        }

        return NextResponse.json(user);
    } catch (error) {
        systemLogger.error("[USER_ROLE_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
