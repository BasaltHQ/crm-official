import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

// GET /api/crm/leads/:leadId/notes
type Params = { params: Promise<{ leadId: string }> };
export async function GET(_req: Request, { params }: Params) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { leadId } = await params;
    if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: { id: true, team_id: true, assigned_to: true },
    });
    if (!lead) return new NextResponse("Lead not found", { status: 404 });
    if (!validateResourceOwnership(teamInfo!.teamId, lead.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (!teamInfo!.isAdmin && lead.assigned_to !== session!.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const notes = await prismadb.crm_Lead_Activities.findMany({
      where: { lead: leadId, type: "note" },
      orderBy: { createdAt: "desc" as const },
      take: 50,
      select: { id: true, type: true, metadata: true, createdAt: true },
    });

    return NextResponse.json({ notes }, { status: 200 });
  } catch (error) {
    systemLogger.error("[LEAD_NOTES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// POST /api/crm/leads/:leadId/notes
export async function POST(req: Request, { params }: Params) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { leadId } = await params;
    if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

    const payload = await req.json().catch(() => ({}));
    const rawText = String(payload?.text ?? "");
    const mentions = Array.isArray(payload?.mentions) ? payload.mentions.map((m: any) => String(m)).slice(0, 20) : [];

    if (!rawText.trim()) {
      return new NextResponse("text is required", { status: 400 });
    }

    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: { id: true, team_id: true, assigned_to: true },
    });
    if (!lead) return new NextResponse("Lead not found", { status: 404 });
    if (!validateResourceOwnership(teamInfo!.teamId, lead.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (!teamInfo!.isAdmin && lead.assigned_to !== session!.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await prismadb.crm_Lead_Activities.create({
      data: {
        lead: leadId,
        user: session!.user.id,
        type: "note",
        metadata: {
          text: rawText.slice(0, 20000),
          mentions,
        } as any,
      },
    });

    import("@/actions/quests/add-raw-xp")
      .then((m) => m.addRawXP({ userId: session!.user.id, xpAmount: 1, reason: "Logged CRM Note" }))
      .catch((e) => systemLogger.warn(`[NOTES_GAMIFICATION] Failed to award XP: ${e?.message}`));

    import("@/actions/university/log-user-metric")
      .then((m) => m.logUserMetric("note_created").catch(() => {}));


    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (error) {
    systemLogger.error("[LEAD_NOTES_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
