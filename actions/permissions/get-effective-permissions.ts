"use server";

import { prismadb } from "@/lib/prisma";
import { ROLE_CONFIGS, TeamRole } from "@/lib/role-permissions";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export async function getEffectiveRoleModules(teamId: string, role: string, scope: string) {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.userId) {
            return [];
        }

        // Enforce tenant boundary (allow parent org / child department or platform admin)
        if (!teamInfo.isPlatformAdmin && teamInfo.teamId !== teamId) {
            const dept = await prismadb.team.findUnique({
                where: { id: teamId },
                select: { parent_id: true },
            });
            if (!dept || dept.parent_id !== teamInfo.teamId) {
                return [];
            }
        }

        if (!(prismadb as any).rolePermission) {
            return [];
        }

        const permission = await (prismadb as any).rolePermission.findUnique({
            where: {
                team_id_role_scope: {
                    team_id: teamId,
                    role,
                    scope,
                },
            },
        });

        if (permission) {
            return permission.modules;
        }

        if (role === "SUPER_ADMIN" || role === "PLATFORM_ADMIN" || role === "PLATFORM ADMIN") {
            return ["*"];
        }

        const config = ROLE_CONFIGS[role as Exclude<TeamRole, "SUPER_ADMIN" | "PLATFORM_ADMIN">];
        return config ? config.defaultModules : [];
    } catch (error) {
        console.error("Failed to fetch effective permissions:", error);
        return [];
    }
}
