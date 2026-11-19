import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { convertLeadToOpportunity } from "@/actions/crm/convert-lead";
import { closeDealAndCreateProject } from "@/actions/crm/close-deal-and-create-project";
import { systemLogger } from "@/lib/logger";

type RequestBody = {
  reason?: string;
};

type Params = { params: Promise<{ leadId: string }> };
export async function POST(req: Request, { params }: Params) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { leadId } = await params;
    if (!leadId) {
      return new NextResponse("Missing leadId", { status: 400 });
    }

    const payload = (await req.json().catch(() => ({}))) as RequestBody;
    const reason = (payload?.reason || "").toString().slice(0, 2000);

    // Load lead to verify tenant ownership and assignment
    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: { id: true, team_id: true, assigned_to: true, outreach_status: true, status: true },
    });
    if (!lead) {
      return new NextResponse("Lead not found", { status: 404 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, lead.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Permission: assigned user or tenant/platform admin can close
    if (!teamInfo!.isAdmin && lead.assigned_to !== session!.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // 1. Convert Lead to Opportunity
    // We only convert if it's not already converted.
    let opportunityId = "";

    // Check if already converted? 
    // convertLeadToOpportunity handles this check internally but returns error if so.
    // If it's already converted, we should try to find the opportunity logic? 
    // For now, let's assume we proceed with conversion or catch "already converted"

    const convertRes = await convertLeadToOpportunity(leadId);

    if (convertRes.success && convertRes.data?.opportunityId) {
      opportunityId = convertRes.data.opportunityId;
    } else if (convertRes.error === "Lead is already converted") {
      // If already converted, find the opportunity?
      // This is tricky without a direct link on the Lead model (we have contact link).
      // But for this "Automation Closure", let's assume valid conversion flow.
      // If it fails, we fall back to just closing the lead? 
      console.log("Lead already converted, creating account not supported without Opp ID.");
      // We could search for an opp with this contact?
      // For now, return error or success without account.
      return new NextResponse("Lead already converted. Please manage via Opportunity.", { status: 400 });
    } else {
      return new NextResponse(convertRes.error || "Failed to convert lead", { status: 500 });
    }

    // 2. Close Opportunity & Create Project
    if (opportunityId) {
      const closeRes = await closeDealAndCreateProject(opportunityId);
      if (!closeRes.success) {
        return new NextResponse(closeRes.error || "Failed to close opportunity", { status: 500 });
      }
    }

    // Log activity
    await prismadb.crm_Lead_Activities.create({
      data: {
        lead: lead.id,
        user: session!.user.id,
        type: "status_changed",
        metadata: { to: "CLOSED_WON", reason, opportunityId } as any,
      },
    });

    return NextResponse.json({ status: "ok", leadId: lead.id }, { status: 200 });
  } catch (error) {

    systemLogger.error("[OUTREACH_CLOSE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
