"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSubscriptionPlan } from "@/lib/subscription";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { validateResourceOwnership } from "@/lib/api-utils";

export async function updateRoleModules(
    teamId: string,
    role: string,
    scope: string, // 'ORGANIZATION' | 'DEPARTMENT'
    modules: string[]
) {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.userId) {
            return { error: "Unauthorized" };
        }

        if (!teamInfo.isAdmin) {
            return { error: "Permission Denied: Only team administrators can manage role permissions." };
        }

        if (!teamId || typeof teamId !== "string" || !Array.isArray(modules)) {
            return { error: "Invalid request payload" };
        }

        const targetTeam = await prismadb.team.findUnique({
            where: { id: teamId },
            include: { assigned_plan: true },
        });

        if (!targetTeam) {
            return { error: "Team not found" };
        }

        const isChildDepartment =
            Boolean(teamInfo.teamId) &&
            (targetTeam as any).team_type === "DEPARTMENT" &&
            targetTeam.parent_id === teamInfo.teamId;

        if (
            !isChildDepartment &&
            !validateResourceOwnership(teamInfo.teamId, teamId, teamInfo.isPlatformAdmin)
        ) {
            return { error: "Permission Denied: Cross-tenant modification is forbidden." };
        }

        // Resolve parent organization plan limits so tenants cannot grant modules outside their plan
        const orgTeam: any =
            (targetTeam as any).team_type === "DEPARTMENT" && targetTeam.parent_id
                ? await prismadb.team.findUnique({
                      where: { id: targetTeam.parent_id },
                      include: { assigned_plan: true },
                  })
                : targetTeam;

        const planSlug = orgTeam?.assigned_plan?.slug || orgTeam?.subscription_plan || "FREE";
        let parentLimits = getSubscriptionPlan(planSlug)?.features || [];

        if (orgTeam?.assigned_plan?.features) {
            parentLimits = Array.from(new Set([...orgTeam.assigned_plan.features, ...parentLimits]));
        }
        if (orgTeam?.module_overrides) {
            parentLimits = Array.from(new Set([...parentLimits, ...((orgTeam.module_overrides as any[]) || [])]));
        }

        const isPlatformSuperAdmin = teamInfo.isPlatformAdmin || parentLimits.includes("all");
        const safeModules = modules.filter((m): m is string => typeof m === "string");
        const finalModules = isPlatformSuperAdmin
            ? safeModules
            : safeModules.filter((m) => parentLimits.includes(m) || parentLimits.includes(`${m}.view`));

        await prismadb.rolePermission.upsert({
            where: {
                team_id_role_scope: {
                    team_id: teamId,
                    role,
                    scope,
                },
            },
            update: {
                modules: finalModules,
            },
            create: {
                team_id: teamId,
                role,
                scope,
                modules: finalModules,
            },
        });

        revalidatePath("/admin/modules");
        return { success: true };
    } catch (error) {
        console.error("Failed to update role modules:", error);
        return { error: "Internal Server Error" };
    }
}
