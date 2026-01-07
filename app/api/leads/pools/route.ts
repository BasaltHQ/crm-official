import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

/**
 * GET /api/leads/pools
 * Returns a list of Lead Pools with simple aggregates:
 * - latest job (status and timestamps)
 * - candidates count
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const teamInfo = await getCurrentUserTeamId();

    // Super Admin sees all pools
    const isGlobalAdmin = teamInfo?.isGlobalAdmin;

    // Team Members see pools assigned to their team
    const teamId = teamInfo?.teamId;

    const whereClause: any = {};
    if (!isGlobalAdmin) {
      if (teamId) {
        whereClause.OR = [
          { team_id: teamId },
          { user: session.user.id }
        ];
      } else {
        whereClause.user = session.user.id;
      }
    }

    const pools = await (prismadbCrm as any).crm_Lead_Pools.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        user: true, // Include user info for admins to see who owns the pool
        icpConfig: true,
        jobs: {
          take: 1,
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            counters: true,
            queryTemplates: true,
          },
        },
        _count: {
          select: { candidates: true },
        },
      },
    });

    const results = pools.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      user: p.user,
      icpConfig: p.icpConfig,
      latestJob: p.jobs?.[0] || null,
      candidatesCount: p._count?.candidates || 0,
    }));

    return NextResponse.json({ pools: results }, { status: 200 });
  } catch (error) {
    console.error("[LEADS_POOLS_GET]", error);
    return new NextResponse("Failed to fetch lead pools", { status: 500 });
  }
}

/**
 * DELETE /api/leads/pools?poolId={poolId}
 * Deletes a lead pool and all associated data
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const poolId = searchParams.get("poolId");

    if (!poolId) {
      return new NextResponse("Missing poolId", { status: 400 });
    }

    // Verify ownership or admin
    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true, team_id: true }
    });

    if (!pool) {
      return new NextResponse("Pool not found", { status: 404 });
    }

    const teamInfo = await getCurrentUserTeamId();
    const isGlobalAdmin = teamInfo?.isGlobalAdmin;
    const isTeamAdmin = teamInfo?.isAdmin; // Team Admin/Owner
    const myTeamId = teamInfo?.teamId;

    // Allow if:
    // 1. Global Admin
    // 2. Creator (pool.user === me)
    // 3. Team Admin AND pool belongs to my team
    const isCreator = pool.user === session.user.id;
    const isTeamPool = pool.team_id === myTeamId;

    if (!isGlobalAdmin && !isCreator && (!isTeamAdmin || !isTeamPool)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    // Delete associated data
    await (prismadbCrm as any).crm_Contact_Candidates.deleteMany({
      where: {
        leadCandidate: {
          in: await (prismadbCrm as any).crm_Lead_Candidates.findMany({
            where: { pool: poolId },
            select: { id: true }
          }).then((candidates: any[]) => candidates.map(c => c.id))
        }
      }
    });

    await (prismadbCrm as any).crm_Lead_Candidates.deleteMany({
      where: { pool: poolId }
    });

    await (prismadbCrm as any).crm_Lead_Source_Events.deleteMany({
      where: {
        job: {
          in: await (prismadbCrm as any).crm_Lead_Gen_Jobs.findMany({
            where: { pool: poolId },
            select: { id: true }
          }).then((jobs: any[]) => jobs.map(j => j.id))
        }
      }
    });

    await (prismadbCrm as any).crm_Lead_Gen_Jobs.deleteMany({
      where: { pool: poolId }
    });

    await (prismadbCrm as any).crm_Lead_Pools.delete({
      where: { id: poolId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[LEADS_POOLS_DELETE]", error);
    return new NextResponse("Failed to delete pool", { status: 500 });
  }
}
