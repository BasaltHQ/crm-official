import { NextResponse } from "next/server";
import { prismadbCrm } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

/**
 * GET /api/crm/leads/pools/[poolId]/candidates
 * Returns lead candidates and their contact candidates for a given pool.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ poolId: string }> }
) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const { poolId } = await context.params;
  if (!poolId) {
    return new NextResponse("Missing poolId", { status: 400 });
  }

  try {
    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true, team_id: true, assigned_members: true },
    });
    if (!pool) return new NextResponse("Pool not found", { status: 404 });

    const isTeamOwned = validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin);
    if (!isTeamOwned) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const isAssigned = Array.isArray(pool.assigned_members) && pool.assigned_members.includes(session!.user.id);
    if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && pool.user !== session!.user.id && !isAssigned) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const candidates = await (prismadbCrm as any).crm_Lead_Candidates.findMany({
      where: { pool: poolId },
      orderBy: { score: "desc" },
      select: {
        id: true,
        domain: true,
        companyName: true,
        homepageUrl: true,
        description: true,
        industry: true,
        techStack: true,
        score: true,
        freshnessAt: true,
        status: true,
        contacts: {
          select: {
            id: true,
            fullName: true,
            title: true,
            email: true,
            emailStatus: true,
            phone: true,
            linkedinUrl: true,
            confidence: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ candidates }, { status: 200 });
  } catch (error) {
    systemLogger.error("[LEADS_POOL_CANDIDATES_GET]", error);
    return new NextResponse("Failed to fetch candidates", { status: 500 });
  }
}
