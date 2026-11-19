import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

type Params = { params: Promise<{ leadId: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { leadId } = await params;
    if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

    const payload = await req.json().catch(() => null);
    const text = String(payload?.text || "").trim();
    if (!text) return new NextResponse("Missing transcript text", { status: 400 });
    const contactId = payload?.contactId ? String(payload.contactId) : undefined;
    const role = payload?.role ? String(payload.role) : undefined;
    const segmentAt = payload?.segmentAt ? Number(payload.segmentAt) : Date.now();
    const extra = payload?.extra || undefined;

    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: { id: true, team_id: true, assigned_to: true },
    });
    if (!lead) {
      return new NextResponse("Lead not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo!.teamId, lead.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    if (!teamInfo!.isAdmin && lead.assigned_to !== session!.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const activity = await prismadb.crm_Lead_Activities.create({
      data: {
        lead: leadId,
        user: session!.user.id,
        type: "call_transcript_segment",
        metadata: {
          text,
          contactId,
          role,
          segmentAt,
          extra,
        } as any,
      },
      select: { id: true, type: true, metadata: true, createdAt: true },
    });

    return NextResponse.json({ saved: true, activity }, { status: 200 });
  } catch (error: any) {
    systemLogger.error("[LEAD_TRANSCRIPT_POST]", error?.message || error);
    return new NextResponse(error?.message || "Internal Error", { status: 500 });
  }
}
