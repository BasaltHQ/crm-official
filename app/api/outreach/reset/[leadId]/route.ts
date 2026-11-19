import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

/**
 * POST /api/outreach/reset/[leadId]
 * Resets a single lead's outreach state back to IDLE and pipeline stage to Identify.
 * Does NOT delete notes or activities; inserts a reset activity for traceability.
 */
export async function POST(_: Request, props: { params: Promise<{ leadId: string }> }) {
  const params = await props.params;
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const leadId = params.leadId;
    if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: { id: true, assigned_to: true, team_id: true },
    });
    if (!lead) return new NextResponse("Lead not found", { status: 404 });

    if (!validateResourceOwnership(teamInfo!.teamId, lead.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    if (!teamInfo!.isAdmin && lead.assigned_to !== session!.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await prismadb.crm_Leads.update({
      where: { id: leadId },
      data: {
        outreach_status: "IDLE" as any,
        outreach_sent_at: null as any,
        outreach_first_message_id: null as any,
        outreach_open_token: null as any,
        pipeline_stage: "Identify" as any,
      },
    });

    await prismadb.crm_Lead_Activities.create({
      data: {
        lead: leadId,
        user: session!.user.id,
        type: "email_reset",
        metadata: { reason: "Manual reset by user" } as any,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
     
    systemLogger.error("[OUTREACH_RESET_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
