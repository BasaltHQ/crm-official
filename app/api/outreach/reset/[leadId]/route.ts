import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/outreach/reset/[leadId]
 * Resets a single lead's outreach state back to IDLE and pipeline stage to Identify.
 * Does NOT delete notes or activities; inserts a reset activity for traceability.
 */
export async function POST(_: Request, { params }: { params: { leadId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const leadId = params.leadId;
    if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

    // Ensure lead exists and (if not admin) is assigned to the user
    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: { id: true, assigned_to: true },
    });
    if (!lead) return new NextResponse("Lead not found", { status: 404 });

    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { id: true, is_admin: true, is_account_admin: true },
    });
    const isAdmin = !!(user?.is_admin || user?.is_account_admin);
    if (!isAdmin && lead.assigned_to !== session.user.id) {
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
        user: session.user.id,
        type: "email_reset",
        metadata: { reason: "Manual reset by user" } as any,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[OUTREACH_RESET_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
