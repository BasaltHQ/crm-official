"use server";

import { prismadb } from "@/lib/prisma";

// Version: 2026-02-12-v5 - Switched to Internal Prisma Client Path
export const getTeams = async () => {
    try {
        const teams = await prismadb.team.findMany({
            where: {
                OR: [
                    { parent_id: null },
                    { parent_id: { isSet: false } }
                ]
            },
            orderBy: {
                created_at: "desc",
            },
            include: {
                members: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true
                    }
                },
                assigned_plan: true,
                team_subscriptions: true,
                departments: {
                    include: {
                        members: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatar: true
                            }
                        }
                    }
                }
            }
        } as any);

        const aggregatedTeams = teams.map((team: any) => {
            const departmentMembers = team.departments?.flatMap((d: any) => d.members) || [];
            const allMembers = [...(team.members || []), ...departmentMembers];
            // Deduplicate by user ID
            const uniqueMembers = Array.from(new Map(allMembers.map(m => [m.id, m])).values());

            return {
                ...team,
                members: uniqueMembers
            };
        });

        return aggregatedTeams;
    } catch (error) {
        console.error("[GET_TEAMS]", error);
        return [];
    }
};
