"use server";

import { cookies } from "next/headers";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { signImpersonatedTeamId } from "@/lib/cookie-utils";
import { logActivityInternal } from "@/actions/audit";
import { normalizeRoleName } from "@/lib/security/authz";

export async function switchTeam(teamId: string | null) {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId) {
            return { error: "Unauthorized" };
        }

        const user = await prismadb.users.findUnique({
            where: { id: currentUser.userId },
            include: { assigned_team: true }
        });

        if (!user || user.userStatus === "INACTIVE") {
            return { error: "Unauthorized" };
        }

        const normalizedRole = normalizeRoleName(user.team_role);
        const isPlatformAdminRole = Boolean(user.is_admin) || normalizedRole === "PLATFORM_ADMIN";
        const isTeamAdminRole = ["OWNER", "ADMIN", "SUPER_ADMIN"].includes(normalizedRole);

        let isAuthorized = isPlatformAdminRole;

        if (teamId && !isAuthorized) {
            if (user.team_id === teamId && (user.is_account_admin || isTeamAdminRole)) {
                isAuthorized = true;
            } else if (user.assigned_team?.parent_id === teamId && (user.is_account_admin || isTeamAdminRole)) {
                // UPWARD traversal: department admin/account_admin switching back to parent organization
                isAuthorized = true;
            } else if (isTeamAdminRole && user.team_id) {
                // DOWNWARD traversal: regular company owner/admin switching to a child department
                const targetTeam = await prismadb.team.findUnique({
                    where: { id: teamId },
                    select: { parent_id: true }
                });
                if (targetTeam?.parent_id && targetTeam.parent_id === user.team_id) {
                    isAuthorized = true;
                }
            }
        }

        if (teamId && !isAuthorized) {
            return { error: "Unauthorized: You do not have permission to switch to this team." };
        }

        const cookieStore = await cookies();

        if (teamId) {
            const team = await prismadb.team.findUnique({
                where: { id: teamId },
                select: { id: true, name: true }
            });

            if (!team) return { error: "Team not found" };

            const signedToken = await signImpersonatedTeamId(teamId, user.id);

            cookieStore.set("impersonated_team_id", signedToken, {
                path: "/",
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 60 * 60 * 24
            });
            
            if (currentUser?.userId) {
                await logActivityInternal(currentUser.userId, "UPDATE", "System", `Context switched to team ${team.name} (${teamId})`);
            }

            revalidatePath("/", "layout");
            return { success: true, message: `Switched to ${team.name}` };
        } else {
            // Clear impersonation
            cookieStore.delete("impersonated_team_id");
            
            if (currentUser?.userId) {
                await logActivityInternal(currentUser.userId, "UPDATE", "System", `Exited context switch`);
            }

            revalidatePath("/", "layout");
            return { success: true, message: "Returned to home team" };
        }
    } catch (error) {
        systemLogger.error("[SWITCH_TEAM]", error);
        return { error: "Failed to switch team" };
    }
}

export async function getAvailableContexts() {
    try {
        const currentUser = await getCurrentUserTeamId();
        if (!currentUser?.userId) return { success: false, options: [], currentTeamId: null, isImpersonating: false };

        const user = await prismadb.users.findUnique({
            where: { id: currentUser.userId },
            include: { 
                assigned_team: {
                    select: { id: true, name: true, parent_id: true }
                }
            }
        });

        const normalizedRole = normalizeRoleName(user?.team_role);
        const isPlatformAdminRole = Boolean(user?.is_admin) || normalizedRole === "PLATFORM_ADMIN";
        const isTeamAdminRole = ["OWNER", "ADMIN", "SUPER_ADMIN"].includes(normalizedRole);

        if (!user || user.userStatus === "INACTIVE" || (!isPlatformAdminRole && !user.is_account_admin && !isTeamAdminRole)) {
            return { success: false, options: [], currentTeamId: currentUser.teamId, isImpersonating: false };
        }

        const options: any[] = [];

        // Always push their home team if it exists
        if (user.assigned_team) {
            options.push({ id: user.assigned_team.id, name: user.assigned_team.name, type: "HOME", isDepartment: !!user.assigned_team.parent_id });

            if (user.assigned_team.parent_id) {
                // They belong to a department. Allow UPWARD traversal to parent Company if they have Platform/Account/Team Admin rights.
                if (isPlatformAdminRole || user.is_account_admin || isTeamAdminRole) {
                    const parent = await prismadb.team.findUnique({ where: { id: user.assigned_team.parent_id }, select: { id: true, name: true } });
                    if (parent) {
                        options.push({ id: parent.id, name: parent.name, type: "COMPANY" });
                    }
                }
            } else if (isPlatformAdminRole || isTeamAdminRole || user.is_account_admin) {
                // They belong to a company. Let them fetch child departments (DOWNWARD traversal).
                const depts = await prismadb.team.findMany({ where: { parent_id: user.assigned_team.id }, select: { id: true, name: true } });
                depts.forEach((d: any) => {
                    options.push({ id: d.id, name: d.name, type: "DEPARTMENT" });
                });
            }
        }

        return { 
            success: true, 
            options, 
            currentTeamId: currentUser.teamId,
            isImpersonating: currentUser.isImpersonating
        };
    } catch {
        return { success: false, options: [], currentTeamId: null, isImpersonating: false };
    }
}

/**
 * Clears the impersonated_team_id cookie. 
 * Must be called during logout to prevent stale impersonation persisting across sessions.
 */
export async function clearImpersonation() {
    try {
        const cookieStore = await cookies();
        cookieStore.delete("impersonated_team_id");
        return { success: true };
    } catch {
        return { success: false };
    }
}
