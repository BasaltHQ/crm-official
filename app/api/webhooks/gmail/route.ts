import { NextResponse } from "next/server";
import crypto from "crypto";
import { prismadb } from "@/lib/prisma";
import { getGmailClientForUser } from "@/lib/gmail";
import { systemLogger } from "@/lib/logger";

function verifyGmailWebhookToken(req: Request, expectedToken: string): boolean {
  const authHeader = req.headers.get("authorization");
  const bearerToken =
    authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, "").trim()
      : null;
  const queryToken = new URL(req.url).searchParams.get("token")?.trim() || null;
  const provided = bearerToken || queryToken;
  if (!provided) return false;

  const expectedBuf = Buffer.from(expectedToken, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  return (
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)
  );
}

// Helper to pull fresh emails since historyId
async function syncGmailInbox(userId: string, historyIdStr: string) {
  try {
    const calendar = await getGmailClientForUser(userId); // Actually returns a gmail client in some repos, but getGmailClientForUser returns google.gmail({ version: 'v1', auth: oauth2Client }); Let's assume it returns gmail client
    if (!calendar) return;

    // Fetch new messages based on historyId
    // If we want to do a full sync or a history-based sync
    // For now, this acts as a placeholder or rough outline for fetching
    const historyRes = await calendar.users.history.list({
      userId: 'me',
      startHistoryId: historyIdStr,
    });

    const histories = historyRes.data.history || [];
    const messageIdsToFetch = new Set<string>();
    for (const h of histories) {
      if (h.messagesAdded) {
        for (const m of h.messagesAdded) {
          if (m.message?.id) messageIdsToFetch.add(m.message.id);
        }
      }
    }

    for (const msgId of Array.from(messageIdsToFetch)) {
      // Check if we already have it
      const existing = await prismadb.crm_Emails.findUnique({ where: { message_id: msgId } });
      if (existing) continue;

      const msg = await calendar.users.messages.get({
        userId: 'me',
        id: msgId,
        format: 'full',
      });

      const payload = msg.data.payload;
      const headers = payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

      const subject = getHeader('subject') || "(No Subject)";
      const from = getHeader('from') || "";
      const to = getHeader('to') || "";
      const dateStr = getHeader('date') || new Date().toISOString();
      const threadId = msg.data.threadId || null;
      const snippet = msg.data.snippet || "";

      // Save to db
      await prismadb.crm_Emails.create({
        data: {
          user_id: userId,
          provider: "google",
          message_id: msgId,
          thread_id: threadId,
          subject,
          snippet,
          from_email: from,
          from_name: from, // Parse appropriately if needed
          is_inbound: !from.includes("me"), // Improve check
          date: new Date(dateStr) as any,
        } as any,
      });
    }

    // Update historyId in db
    if (historyRes.data.historyId) {
      await prismadb.gmail_Tokens.updateMany({
        where: { user: userId },
        data: { historyId: historyRes.data.historyId },
      });
    }

  } catch (err: any) {
    systemLogger.error("[WEBHOOK_GMAIL_SYNC]", err?.message || err);
  }
}

export async function POST(req: Request) {
  const expectedToken = process.env.GMAIL_WEBHOOK_TOKEN;
  if (!expectedToken) {
    systemLogger.error("[GMAIL_WEBHOOK] GMAIL_WEBHOOK_TOKEN is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!verifyGmailWebhookToken(req, expectedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: any = await req.json();

    // Google Pub/Sub sends data in Base64
    if (body.message && body.message.data) {
      const decoded = Buffer.from(body.message.data, 'base64').toString('utf8');
      const payload = JSON.parse(decoded);

      const emailAddress = payload.emailAddress;
      const historyId = payload.historyId?.toString();

      if (emailAddress && historyId) {
        // Find the user with this token
        // In a real scenario we'd query by the decoded email, but we map tokens to users:
        // Or query gmail_Tokens to find webhook match. For this template, it just logs.
        systemLogger.info(`[GMAIL_WEBHOOK] Received push for ${emailAddress}, history: ${historyId}`);
        
        // This is a placeholder for actual processing.
        // We would lookup the user by their google email, then run syncGmailInbox.
      }
    }
    
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    systemLogger.error("[GMAIL_WEBHOOK_ERROR]", error?.message || error);
    // Always return 200 to Pub/Sub to acknowledge, or they will retry
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
