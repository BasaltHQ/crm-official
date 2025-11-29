import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

/**
 * GET /api/outreach/meeting/[leadId]
 * Resolves meeting link for the lead (lead.outreach_meeting_link -> assigned user's meeting_link),
 * logs crm_Lead_Activities: "meeting_link_clicked", and redirects (302) to the external meeting URL.
 * If meeting link cannot be resolved, returns 400.
 */
type Params = { params: Promise<{ leadId: string }> };
export async function GET(
  _req: Request,
  { params }: Params
) {
  try {
    const { leadId } = await params;
    if (!leadId) {
      return new NextResponse("Missing leadId", { status: 400 });
    }

    // Load lead with assigned user info
    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        assigned_to: true,
        outreach_meeting_link: true,
      },
    });

    if (!lead) {
      return new NextResponse("Lead not found", { status: 404 });
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
    return NextResponse.redirect(meetingLink, { status: 302 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[OUTREACH_MEETING_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
