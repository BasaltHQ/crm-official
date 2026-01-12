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
    // Verify user role
    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { team_role: true }
    });

    const isMember = user?.team_role === "MEMBER";
    const teamInfo = await getCurrentUserTeamId();
    const isGlobalAdmin = teamInfo?.isGlobalAdmin;
    const teamId = teamInfo?.teamId;

    const poolSelect = {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      user: true,
      icpConfig: true,
      assigned_members: true,
      jobs: {
        take: 1,
        orderBy: { startedAt: "desc" as const },
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
    };

    let pools: any[] = [];

    if (isGlobalAdmin) {
      // All pools
      pools = await (prismadbCrm as any).crm_Lead_Pools.findMany({
        orderBy: { createdAt: "desc" },
        select: poolSelect,
      });
    } else if (isMember) {
      // Members: Use two separate queries and merge to avoid OR clause issues
      console.log("[LEADS_POOLS_GET] Member query - fetching pools for user:", session.user.id);

      // Query 1: Pools created by member
      const createdPools = await (prismadbCrm as any).crm_Lead_Pools.findMany({
        where: { user: session.user.id },
        orderBy: { createdAt: "desc" },
        select: poolSelect,
      });
      console.log("[LEADS_POOLS_GET] Created pools count:", createdPools.length);

      // Query 2: Pools where member is assigned
      const assignedPools = await (prismadbCrm as any).crm_Lead_Pools.findMany({
        where: { assigned_members: { has: session.user.id } },
        orderBy: { createdAt: "desc" },
        select: poolSelect,
      });
      console.log("[LEADS_POOLS_GET] Assigned pools count:", assignedPools.length);

      // Merge and dedupe by id
      const poolMap = new Map<string, any>();
      for (const p of createdPools) poolMap.set(p.id, p);
      for (const p of assignedPools) poolMap.set(p.id, p);
      pools = Array.from(poolMap.values());

      // Sort by createdAt desc
      pools.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      // Admins/Team Owners: Team + Own
      if (teamId) {
        pools = await (prismadbCrm as any).crm_Lead_Pools.findMany({
          where: {
            OR: [
              { team_id: teamId },
              { user: session.user.id }
            ]
          },
          orderBy: { createdAt: "desc" },
          select: poolSelect,
        });
      } else {
        pools = await (prismadbCrm as any).crm_Lead_Pools.findMany({
          where: { user: session.user.id },
          orderBy: { createdAt: "desc" },
          select: poolSelect,
        });
      }
    }

    console.log("[LEADS_POOLS_GET] Total pools returned:", pools.length);

    const results = pools.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      user: p.user,
      icpConfig: p.icpConfig,
      assignedMembers: p.assigned_members || [],
      latestJob: p.jobs?.[0] || null,
      candidatesCount: p._count?.candidates || 0,
    }));

    return NextResponse.json({ pools: results }, { status: 200 });
  } catch (error: any) {
    console.error("[LEADS_POOLS_GET] Error:", error?.message || error);
    console.error("[LEADS_POOLS_GET] Stack:", error?.stack);
    return new NextResponse(JSON.stringify({ error: error?.message || "Failed to fetch lead pools" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
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
