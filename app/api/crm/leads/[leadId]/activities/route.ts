import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

// GET /api/crm/leads/:leadId/activities
// Returns recent lead activities (latest first). Strictly scoped to tenant + assignment.
type Params = { params: Promise<{ leadId: string }> };
export async function GET(_req: Request, { params }: Params) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { leadId: rawLeadId } = await params;
    if (!rawLeadId) return new NextResponse("Missing leadId", { status: 400 });

    const teamScope =
      !teamInfo!.isPlatformAdmin && teamInfo!.teamId
        ? { team_id: teamInfo!.teamId }
        : {};

    let leadId = rawLeadId;

    // If the provided ID is not a lead, but a contact, find the lead within the same tenant
    const contact = await prismadb.crm_Contacts.findFirst({
      where: { id: rawLeadId, ...teamScope },
      select: { tags: true, email: true, team_id: true }
    });

    if (contact) {
      const leadIdTag = Array.isArray(contact.tags)
        ? (contact.tags as any[]).find(t => typeof t === "string" && t.startsWith("leadId:"))
        : null;
      if (leadIdTag) {
        leadId = leadIdTag.split(":")[1];
      } else if (contact.email) {
        const leadByEmail = await prismadb.crm_Leads.findFirst({
          where: {
            email: contact.email,
            ...(contact.team_id ? { team_id: contact.team_id } : teamScope),
          },
          select: { id: true }
        });
        if (leadByEmail) leadId = leadByEmail.id;
      }
    } else {
      // Check if it's an account within the same tenant
      const account = await prismadb.crm_Accounts.findFirst({
        where: { id: rawLeadId, ...teamScope },
        select: { email: true, team_id: true }
      });
      if (account && account.email) {
        const leadByEmail = await prismadb.crm_Leads.findFirst({
          where: {
            email: account.email,
            ...(account.team_id ? { team_id: account.team_id } : teamScope),
          },
          select: { id: true }
        });
        if (leadByEmail) leadId = leadByEmail.id;
      }
    }

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

    const activities = await prismadb.crm_Lead_Activities.findMany({
      where: { lead: leadId },
      orderBy: { createdAt: "desc" as const },
      take: 50,
      include: {
        assigned_user: {
          select: {
            name: true,
            avatar: true,
          }
        }
      }
    });

    // Fetch associated outreach items for email tracking details
    const trackingTokens = (activities as any[])
      .filter((a: any) => a.type === "EMAIL" && (a.metadata as any)?.trackingToken)
      .map((a: any) => (a.metadata as any).trackingToken);

    const outreachItems = await prismadb.crm_Outreach_Items.findMany({
      where: { tracking_token: { in: trackingTokens } },
    });

    // Merge activities with outreach items
    const mergedActivities = (activities as any[]).map(activity => {
      if (activity.type === "EMAIL") {
        const token = (activity.metadata as any)?.trackingToken;
        const outreach = (outreachItems as any[]).find((o: any) => o.tracking_token === token);
        return {
          ...activity,
          outreach
        };
      }
      return activity;
    });

    // Fetch Native Synced Emails from Google/Microsoft
    const syncedEmails = await prismadb.crm_Emails.findMany({
      where: { lead_id: leadId },
      orderBy: { date: "desc" },
      take: 50,
      include: {
        assigned_user: {
          select: { name: true, avatar: true }
        }
      }
    });

    const mappedEmails = syncedEmails.map((email: any) => ({
      id: email.id,
      type: email.is_inbound ? 'reply_received' : 'EMAIL',
      metadata: {
        subject: email.subject,
        snippet: email.snippet,
        from_email: email.from_email,
        messageId: email.message_id,
        threadId: email.thread_id,
        provider: email.provider
      },
      createdAt: email.date,
      assigned_user: email.assigned_user ? {
        name: email.assigned_user.name,
        avatar: (email.assigned_user as any).avatar || (email.assigned_user as any).image
      } : undefined
    }));

    // Combine, sort, and slice
    const allTimeline = [...mergedActivities, ...mappedEmails]
      .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
      .slice(0, 75);

    return NextResponse.json({ activities: allTimeline }, { status: 200 });
  } catch (error) {

    systemLogger.error("[LEAD_ACTIVITIES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
