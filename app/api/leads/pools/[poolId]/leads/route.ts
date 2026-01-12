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

    // Verify user role directly
    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { team_role: true }
    });

    // Permission check
    // 1. Global Admin (simplified check or rely on isGlobalAdmin from teamInfo if reliable, but role is better)
    // 2. Pool Owner
    // 3. Team Admin (if pool is in team)

    const teamInfo = await getCurrentUserTeamId();
    const isGlobalAdmin = teamInfo?.isGlobalAdmin;
    const isTeamAdmin = user?.team_role === "ADMIN" || user?.team_role === "OWNER";

    // Fetch pool with team_id
    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true, team_id: true },
    });

    if (!pool) return new NextResponse("Pool not found", { status: 404 });

    const isOwner = pool.user === session.user.id;
    const isTeamMatch = pool.team_id === teamInfo?.teamId;

    if (!isGlobalAdmin && !isOwner && !(isTeamAdmin && isTeamMatch)) {
      // If just a MEMBER, they are blocked unless they own it
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

    // Also fetch candidates to show potentially unconverted pool members
    const candidates = await (prismadbCrm as any).crm_Lead_Candidates.findMany({
      where: { pool: poolId },
      include: {
        contacts: {
          orderBy: { confidence: "desc" },
          take: 1,
        },
      },
    });

    const candidateLeads = candidates.map((c: any) => {
      const contact = c.contacts?.[0];
      const nameParts = contact?.fullName?.split(" ") || [];
      const lastName = nameParts.length > 1 ? nameParts.pop() : (contact?.fullName || c.companyName || "Candidate");
      const firstName = nameParts.join(" ");

      return {
        id: c.id,
        firstName: firstName || "",
        lastName: lastName as string,
        company: c.companyName || null,
        jobTitle: contact?.title || null,
        email: contact?.email || null,
        phone: contact?.phone || null,
        description: c.description,
        lead_source: "POOL_CANDIDATE",
        status: c.status || "NEW",
        type: "CANDIDATE",
        outreach_status: "IDLE",
        pipeline_stage: "Identify",
        createdAt: c.freshnessAt || new Date(),
        updatedAt: new Date(),
      };
    });

    // Merge and sort
    const allLeads = [...leads, ...candidateLeads].sort((a: any, b: any) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return NextResponse.json({ leads: allLeads }, { status: 200 });
  } catch (error) {
    console.error("[POOL_LEADS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
