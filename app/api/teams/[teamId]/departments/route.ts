import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

/**
 * GET /api/teams/[teamId]/departments
 * Lists all departments under the given organization team.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await params;
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!validateResourceOwnership(teamInfo!.teamId, teamId, teamInfo!.isPlatformAdmin)) {
            // Also allow members currently scoped to a child department of teamId to list sibling departments
            let isChildMember = false;
            if (teamInfo!.teamId) {
                const callerTeam = await prismadb.team.findUnique({
                    where: { id: teamInfo!.teamId },
                    select: { parent_id: true },
                });
                isChildMember = callerTeam?.parent_id === teamId;
            }
            if (!isChildMember) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const departments = await prismadb.team.findMany({
            where: {
                parent_id: teamId,
                team_type: "DEPARTMENT",
            } as any,
            select: {
                id: true,
                name: true,
                slug: true,
                _count: {
                    select: { members: true },
                },
            },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({ departments });
    } catch (error) {
        console.error("[TEAMS_DEPARTMENTS_GET]", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
