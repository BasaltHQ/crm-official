import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

/**
 * POST /api/outreach/reset-pool/[poolId]
 * Body: { leadIds: string[] }
 * Resets outreach state for the provided leadIds within the given pool context.
 * Strictly enforces tenant ownership on both the pool and the leads.
 */
export async function POST(req: Request, context: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await context.params;
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const pool = await prismadb.crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { id: true, team_id: true },
    });
    if (!pool) {
      return new NextResponse("Pool not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { leadIds } = await req.json().catch(() => ({ leadIds: [] }));
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return new NextResponse("No leads provided", { status: 400 });
    }

    const targetTeamId = pool.team_id || teamInfo!.teamId;
    if (!targetTeamId && !teamInfo!.isPlatformAdmin) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Fetch leads strictly scoped to the pool's tenant (and assigned_to unless tenant/platform admin)
    const leads = await prismadb.crm_Leads.findMany({
      where: {
        id: { in: leadIds },
        ...(targetTeamId ? { team_id: targetTeamId } : {}),
        ...(teamInfo!.isAdmin ? {} : { assigned_to: session!.user.id }),
      },
      select: { id: true },
    });

    if (!leads.length) {
      return NextResponse.json({ ok: true, reset: 0, message: "No matching leads to reset" });
    }

    const ids = (leads as any[]).map((l: any) => l.id);

    await prismadb.crm_Leads.updateMany({
      where: {
        id: { in: ids },
        ...(targetTeamId ? { team_id: targetTeamId } : {}),
      },
      data: {
        outreach_status: "IDLE" as any,
        outreach_sent_at: null as any,
        outreach_first_message_id: null as any,
        outreach_open_token: null as any,
        pipeline_stage: "Identify" as any,
      },
    });

    // Insert a single pool-level activity per lead for traceability
    await Promise.all(ids.map((leadId) => prismadb.crm_Lead_Activities.create({
      data: {
        lead: leadId,
        user: session!.user.id,
        type: "email_reset",
        metadata: { reason: "Pool reset by user", poolId } as any,
      },
    })));

    return NextResponse.json({ ok: true, reset: ids.length });
  } catch (error) {
     
    systemLogger.error("[OUTREACH_RESET_POOL_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
