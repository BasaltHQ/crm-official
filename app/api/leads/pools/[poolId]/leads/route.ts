import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { prismadbCrm } from "@/lib/prisma-crm";
import { getCurrentUserTeamId } from "@/lib/team-utils";

// GET /api/leads/pools/[poolId]/leads?mine=true
// Returns leads converted from a pool; if mine=true, restrict to current user's assigned leads.
export async function GET(req: Request, context: { params: Promise<{ poolId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { poolId } = await context.params;
    if (!poolId) return new NextResponse("Missing poolId", { status: 400 });

    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine") === "true";

    // Verify pool belongs to current user (assigned_user) or allow if admin/super admin
    const teamInfo = await getCurrentUserTeamId();
    const isAdmin = teamInfo?.isGlobalAdmin || teamInfo?.isAdmin;

    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true },
    });
    if (!pool) return new NextResponse("Pool not found", { status: 404 });
    if (!isAdmin && pool.user !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Get lead ids linked to this pool through crm_Lead_Pools_Leads
    const poolLeads = await (prismadbCrm as any).crm_Lead_Pools_Leads.findMany({
      where: { pool: poolId },
      select: { lead: true },
    });
    const leadIds = poolLeads.map((pl: any) => pl.lead);

    // Fetch leads from primary DB and restrict to mine if requested (assigned_to=user)
    const leads = await prismadb.crm_Leads.findMany({
      where: {
        id: { in: leadIds },
        ...(mine ? { assigned_to: session.user.id } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        jobTitle: true,
        email: true,
        phone: true,
        description: true,
        lead_source: true,
        status: true,
        type: true,
        outreach_status: true,
        outreach_sent_at: true,
        outreach_opened_at: true,
        outreach_meeting_booked_at: true,
        outreach_meeting_link: true,
        outreach_notes: true,
        pipeline_stage: true,
        sms_status: true,
        call_status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" as const },
    });

    return NextResponse.json({ leads }, { status: 200 });
  } catch (error) {
    console.error("[POOL_LEADS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
