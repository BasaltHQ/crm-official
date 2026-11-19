"use server";

import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { requirePlatformAdmin, sanitizeUser } from "@/lib/security/authz";

export const getTeam = async (teamId: string) => {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return null;
        }

        const team = await prismadb.team.findUnique({
            where: {
                id: teamId,
            },
            include: {
                assigned_plan: true,
                members: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        team_role: true,
                    }
                }
            }
        });

        if (!team) return null;

        return {
            ...team,
            members: sanitizeUser(team.members),
        };
    } catch (error) {
        systemLogger.error("[GET_TEAM]", error);
        return null;
    }
};
