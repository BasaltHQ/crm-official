import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { ensureAccountForLead } from "@/actions/crm/lead-conversions";

/**
 * POST /api/outreach/close/[leadId]
 * Body: { reason?: string }
 * Manually closes outreach for a lead (sets outreach_status = "CLOSED") and logs activity.
 * Only the assigned user or admins can close.
 */
type RequestBody = {
  reason?: string;
};

type Params = { params: Promise<{ leadId: string }> };
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { leadId } = await params;
    if (!leadId) {
      return new NextResponse("Missing leadId", { status: 400 });
    }

    const payload = (await req.json().catch(() => ({}))) as RequestBody;
    const reason = (payload?.reason || "").toString().slice(0, 2000);

    // Load user (to check admin)
    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { is_admin: true, is_account_admin: true },
    });
    const isAdmin = !!(user?.is_admin || user?.is_account_admin);

    // Load lead to verify assignment
    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: { id: true, assigned_to: true, outreach_status: true },
    });
    if (!lead) {
      return new NextResponse("Lead not found", { status: 404 });
    }

    // Permission: assigned user or admin can close
    if (!isAdmin && lead.assigned_to !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Update lead status to CLOSED and set pipeline stage to Closed
    await prismadb.crm_Leads.update({
      where: { id: lead.id },
      data: {
        outreach_status: "CLOSED" as any,
        pipeline_stage: "Closed" as any,
      },
    });

    // Ensure an Account exists for this lead now that it's closed
    await ensureAccountForLead(lead.id).catch(() => {});

    // Log activity
    await prismadb.crm_Lead_Activities.create({
      data: {
        lead: lead.id,
        user: session.user.id,
        type: "status_changed",
        metadata: { to: "CLOSED", reason } as any,
      },
    });

    return NextResponse.json({ status: "ok", leadId: lead.id }, { status: 200 });
  } catch (error) {
     
    console.error("[OUTREACH_CLOSE_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
