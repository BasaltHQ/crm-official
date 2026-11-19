import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

type Params = { params: Promise<{ leadId: string }> };
export async function GET(
  _req: Request,
  { params }: Params
) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  try {
    const { leadId } = await params;
    if (!leadId) {
      return new NextResponse("Missing leadId", { status: 400 });
    }

    // Load lead with assigned user + team_id
    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        team_id: true,
        assigned_to: true,
        outreach_meeting_link: true,
      },
    });

    if (!lead) {
      return new NextResponse("Lead not found", { status: 404 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, lead.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Determine meeting link
    let meetingLink = lead.outreach_meeting_link || null;

    if (!meetingLink && lead.assigned_to) {
      const user = await prismadb.users.findUnique({
        where: { id: lead.assigned_to },
        select: { meeting_link: true },
      });
      meetingLink = user?.meeting_link || null;
    }

    if (!meetingLink) {
      return new NextResponse("No meeting link configured", { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(meetingLink);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return new NextResponse("Invalid meeting link protocol", { status: 400 });
      }
    } catch {
      return new NextResponse("Invalid meeting link URL", { status: 400 });
    }

    // Log activity: meeting_link_clicked
    await prismadb.crm_Lead_Activities.create({
      data: {
        lead: lead.id,
        type: "meeting_link_clicked",
        metadata: {} as any,
      },
    });

    // Optionally set status to MEETING_LINK_CLICKED (does not assert booking)
    await prismadb.crm_Leads.update({
      where: { id: lead.id },
      data: {
        outreach_status: "MEETING_LINK_CLICKED" as any,
      },
    });

    // Redirect to external meeting link
    return NextResponse.redirect(parsedUrl.toString(), { status: 302 });
  } catch (error) {
     
    systemLogger.error("[OUTREACH_MEETING_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
