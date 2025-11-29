import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/outreach/reset-pool/[poolId]
 * Body: { leadIds: string[] }
 * Resets outreach state for the provided leadIds within the given pool context.
 * Only allows resetting leads assigned to the current user (unless admin).
 */
export async function POST(req: Request, context: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await context.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { leadIds } = await req.json().catch(() => ({ leadIds: [] }));
    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return new NextResponse("No leads provided", { status: 400 });
    }

    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { id: true, is_admin: true, is_account_admin: true },
    });
    const isAdmin = !!(user?.is_admin || user?.is_account_admin);

    // Fetch leads scoped to user unless admin
    const leads = await prismadb.crm_Leads.findMany({
      where: {
        id: { in: leadIds },
        ...(isAdmin ? {} : { assigned_to: session.user.id }),
      },
      select: { id: true },
    });

    if (!leads.length) {
      return NextResponse.json({ ok: true, reset: 0, message: "No matching leads to reset" });
    }

    const ids = leads.map((l) => l.id);

    await prismadb.crm_Leads.updateMany({
      where: { id: { in: ids } },
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
        user: session.user.id,
        type: "email_reset",
        metadata: { reason: "Pool reset by user", poolId } as any,
      },
    })));

    return NextResponse.json({ ok: true, reset: ids.length });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[OUTREACH_RESET_POOL_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
