import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClientForUser } from "@/lib/gmail";
import { prismadb } from "@/lib/prisma";
import { ensureContactForLead } from "@/actions/crm/lead-conversions";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/sync?days=90
 * Pulls recent threads from Gmail (messages sent by me) and updates pipeline stages when replies are detected.
 * - Marks Leads with matching reply sender email as pipeline_stage = Engage_Human
 * - Logs crm_Lead_Activities(type="reply_received") for auditing
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const daysParam = url.searchParams.get("days");
    const days = Math.max(1, Math.min(365, parseInt(daysParam || "90", 10) || 90));

    const gmail = await getGmailClientForUser(session.user.id);
    if (!gmail) {
      return new NextResponse("Gmail not connected", { status: 400 });
    }

    // Get my email address
    const profile = await gmail.users.getProfile({ userId: "me" });
    const myEmail = (profile.data.emailAddress || "").toLowerCase();

    // List messages from me in the last N days
    const q = `from:me newer_than:${days}d`;
    const messageIds: string[] = [];
    let pageToken: string | undefined = undefined;
    do {
      const resp: any = await gmail.users.messages.list({ userId: "me", q, maxResults: 500, pageToken });
      const msgs = resp.data.messages || [];
      for (const m of msgs) {
        if (m.id) messageIds.push(m.id);
      }
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken);

    // Collect thread IDs
    const threadIds = new Set<string>();
    for (const mid of Array.from(messageIds)) {
      const meta = await gmail.users.messages.get({ userId: "me", id: mid, format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date", "Message-Id", "In-Reply-To", "References"] });
      if (meta.data.threadId) threadIds.add(meta.data.threadId);
    }

    // Process threads and collect reply senders
    const replySenders = new Set<string>();
    for (const tid of Array.from(threadIds)) {
      const th = await gmail.users.threads.get({ userId: "me", id: tid, format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date", "Message-Id", "In-Reply-To", "References"] });
      const messages = th.data.messages || [];
      for (const m of messages) {
        const headers = (m.payload?.headers || []).reduce<Record<string, string>>((acc, h) => {
          const name = (h.name || "").toLowerCase();
          acc[name] = h.value || "";
          return acc;
        }, {});
        const from = (headers["from"] || "").toLowerCase();
        // Parse email from From header (basic)
        const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s@]+@[^\s@]+)/);
        const senderEmail = (emailMatch && emailMatch[1]) ? emailMatch[1] : (emailMatch ? emailMatch[0] : "");
        if (senderEmail && senderEmail !== myEmail) {
          replySenders.add(senderEmail);
        }
      }
    }

    // Update leads that match reply senders
    let updatedCount = 0;
    for (const sender of Array.from(replySenders)) {
      const lead = await prismadb.crm_Leads.findFirst({ where: { email: sender } });
      if (!lead) continue;

      await prismadb.crm_Leads.update({
        where: { id: lead.id },
        data: { pipeline_stage: "Engage_Human" as any } as any,
      });

      // Ensure contact exists for this lead after moving beyond Identify
      await ensureContactForLead(lead.id).catch(() => {});

      await prismadb.crm_Lead_Activities.create({
        data: {
          lead: lead.id,
          user: session.user.id,
          type: "reply_received",
          metadata: { from_email: sender } as any,
        },
      });

      updatedCount++;
    }

    return NextResponse.json({ threads: threadIds.size, repliesDetected: replySenders.size, leadsUpdated: updatedCount }, { status: 200 });
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error("[GMAIL_SYNC_GET]", error?.message || error);
    return new NextResponse("Failed to sync Gmail", { status: 500 });
  }
}
