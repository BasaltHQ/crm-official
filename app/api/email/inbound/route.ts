import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { analyzeReplySentiment } from "@/actions/crm/analyze-sentiment";
import { ensureContactForLead } from "@/actions/crm/lead-conversions";
/**
 * POST /api/email/inbound
 * Webhook for AWS SES Inbound Email via Amazon SNS.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid JSON", { status: 400 });
    }

    // 1. Handle SNS Subscription Confirmation
    if (body.Type === "SubscriptionConfirmation") {
      systemLogger.info(`[SES_INBOUND] Confirming SNS Subscription`);
      if (body.SubscribeURL) {
        try {
          await fetch(body.SubscribeURL, { cache: "no-store", method: "GET" });
        } catch (fetchErr) {
          systemLogger.error(`[SES_INBOUND] SNS confirmation failed:`, fetchErr);
        }
      }
      return new NextResponse("OK", { status: 200 });
    }

    // 2. Handle Notification (Actual Email)
    if (body.Type === "Notification") {
      let emailMessage;
      try {
        emailMessage = JSON.parse(body.Message);
      } catch {
        systemLogger.warn("[SES_INBOUND] Could not parse Notification Message JSON.");
        return new NextResponse("Invalid SES Message", { status: 400 });
      }

      if (emailMessage.notificationType !== "Received") {
        return new NextResponse("Ignored", { status: 200 });
      }

      const mail = emailMessage.mail;
      const headers = mail?.headers || [];
      const commonHeaders = mail?.commonHeaders || {};

      const fromAddress = commonHeaders.from?.[0] || "";
      const toAddresses = commonHeaders.to || [];
      const subject = commonHeaders.subject || "(No Subject)";
      const inboundMessageId = mail?.messageId;

      // Extract In-Reply-To and References
      const inReplyToHeader = headers.find((h: any) => h.name.toLowerCase() === "in-reply-to")?.value;
      const referencesHeader = headers.find((h: any) => h.name.toLowerCase() === "references")?.value;
      
      // Normalize message IDs — strip angle brackets for comparison
      const normalizeId = (id?: string) => id?.replace(/[<>]/g, "").trim();
      const inReplyTo = normalizeId(inReplyToHeader);
      
      let matchedOutreachItem: any = null;

      // Match via In-Reply-To — try both normalized and raw formats
      if (inReplyTo) {
        // First try without angle brackets (normalized)
        matchedOutreachItem = await prismadb.crm_Outreach_Items.findFirst({
          where: { message_id: inReplyTo },
          select: { id: true, campaign: true, lead: true, account_id: true, subject: true, sender_email: true },
        });
        
        // Also try with angle brackets (some providers store them that way)
        if (!matchedOutreachItem && inReplyToHeader) {
          matchedOutreachItem = await prismadb.crm_Outreach_Items.findFirst({
            where: { message_id: inReplyToHeader.trim() },
            select: { id: true, campaign: true, lead: true, account_id: true, subject: true, sender_email: true },
          });
        }
      }

      // Fallback: match via References header
      if (!matchedOutreachItem && referencesHeader) {
        const refs = referencesHeader.split(/\s+/).filter(Boolean);
        // Build an array with both raw and normalized versions
        const allRefs = refs.flatMap((r: string) => [normalizeId(r), r.trim()]).filter(Boolean) as string[];
        if (allRefs.length > 0) {
          matchedOutreachItem = await prismadb.crm_Outreach_Items.findFirst({
            where: { message_id: { in: allRefs } },
            select: { id: true, campaign: true, lead: true, account_id: true, subject: true, sender_email: true },
          });
        }
      }

      // Parse email body from raw MIME content
      const bodyText = parseEmailBody(emailMessage.content);

      // Fetch campaign context
      let campaignRecord: any = null;
      if (matchedOutreachItem?.campaign) {
        campaignRecord = await prismadb.crm_Outreach_Campaigns.findUnique({
          where: { id: matchedOutreachItem.campaign },
          select: { user: true, team_id: true, auto_reply_enabled: true }
        });
      }

      // Resolve the correct user for routing:
      // 1. sender_email on the outreach item (most reliable)
      // 2. Parse the reply-to address prefix (e.g., mmilton@reply.basalthq.com → mmilton)
      // 3. Fall back to campaign owner
      let resolvedUserId = campaignRecord?.user || undefined;

      // Strategy 1: Look up user by sender_email on the outreach item
      if (matchedOutreachItem?.sender_email) {
        try {
          const senderUser = await prismadb.users.findFirst({
            where: { email: matchedOutreachItem.sender_email },
            select: { id: true },
          });
          if (senderUser) resolvedUserId = senderUser.id;
        } catch { /* fall back */ }
      }

      // Strategy 2: Parse the "To" address prefix to match a user
      // e.g., mmilton@reply.basalthq.com → find user whose email starts with "mmilton@"
      if (resolvedUserId === campaignRecord?.user && toAddresses.length > 0) {
        try {
          const replyToAddr = toAddresses.find((a: string) => a.includes("reply."));
          if (replyToAddr) {
            const prefix = replyToAddr.split("@")[0].toLowerCase(); // "mmilton"
            if (prefix && prefix !== "sysadm") {
              // 2a: Try team-scoped match
              let matchedUser = campaignRecord?.team_id
                ? await prismadb.users.findFirst({
                    where: {
                      team_id: campaignRecord.team_id,
                      email: { startsWith: prefix + "@", mode: "insensitive" },
                    },
                    select: { id: true, name: true },
                  })
                : null;

              // 2b: Fallback — global match without team_id scoping
              if (!matchedUser) {
                matchedUser = await prismadb.users.findFirst({
                  where: {
                    email: { startsWith: prefix + "@", mode: "insensitive" },
                  },
                  select: { id: true, name: true },
                });
              }

              // 2c: Last resort — contains match (e.g., prefix "mmilton" in "michael.mmilton@...")
              if (!matchedUser) {
                matchedUser = await prismadb.users.findFirst({
                  where: {
                    email: { contains: prefix, mode: "insensitive" },
                  },
                  select: { id: true, name: true },
                });
              }

              if (matchedUser) {
                resolvedUserId = matchedUser.id;
                systemLogger.info(`[SES_INBOUND] Resolved user from reply-to prefix "${prefix}": ${matchedUser.name} (${matchedUser.id})`);
              } else {
                systemLogger.warn(`[SES_INBOUND] Could not resolve user from reply-to prefix "${prefix}". Falling back to campaign owner.`);
              }
            }
          }
        } catch { /* fall back to campaign owner */ }
      }

      let finalLeadId = matchedOutreachItem?.lead || undefined;
      let sentimentResult: any = null;

      if (matchedOutreachItem) {
        // Analyze Sentiment & Extract Contact Info (if Account sequence)
        const isAccountOnly = !matchedOutreachItem.lead && matchedOutreachItem.account_id;
        try {
          sentimentResult = await analyzeReplySentiment(
            bodyText,
            {
              originalSubject: matchedOutreachItem.subject || subject,
              leadName: isAccountOnly ? "Account Contact" : undefined,
              extractContact: !!isAccountOnly,
            },
            resolvedUserId || "sysadm",
            {
              teamId: campaignRecord?.team_id,
              outreachItemId: matchedOutreachItem.id,
              messageId: inboundMessageId,
              provider: "ses",
            },
          );

          if (isAccountOnly && sentimentResult?.extractedContact) {
            const ext = sentimentResult.extractedContact;
            // Create the new lead
            const newLead = await prismadb.crm_Leads.create({
              data: {
                firstName: ext.firstName || "",
                lastName: ext.lastName || "",
                jobTitle: ext.jobTitle || "",
                phone: ext.phone || "",
                email: fromAddress,
                accountsIDs: matchedOutreachItem.account_id,
                team_id: campaignRecord?.team_id,
                pipeline_stage: "Engage_Human" as any,
                outreach_status: sentimentResult.sentiment === "POSITIVE" 
                  ? "REPLIED_POSITIVE" 
                  : sentimentResult.sentiment === "NEGATIVE" 
                    ? "REPLIED_NEGATIVE" 
                    : undefined,
              } as any
            });
            finalLeadId = newLead.id;
            await ensureContactForLead(newLead.id).catch(() => {});
            systemLogger.info(`[SES_INBOUND] Created new lead ${newLead.id} for account ${matchedOutreachItem.account_id}`);
          }
        } catch (analyzerErr) {
          systemLogger.error(`[SES_INBOUND] Sentiment analysis failed`, analyzerErr);
        }
      }

      // Create Email Thread entry
      const newThread = await prismadb.crm_Email_Thread.create({
        data: {
          team_id: campaignRecord?.team_id || "600000000000000000000000",
          user: resolvedUserId,
          lead: finalLeadId,
          campaign: matchedOutreachItem?.campaign || undefined,
          outreach_item: matchedOutreachItem?.id || undefined,
          thread_subject: subject,
          message_id: inboundMessageId,
          direction: "INBOUND",
          from_email: fromAddress,
          to_email: toAddresses.join(", "),
          subject: subject,
          body_text: bodyText,
          receivedAt: new Date(),
        } as any,
      });

      if (matchedOutreachItem) {
        // Update Outreach Item Status
        await prismadb.crm_Outreach_Items.update({
          where: { id: matchedOutreachItem.id },
          data: {
            lead: finalLeadId,
            status: "REPLIED" as any,
            repliedAt: new Date(),
            reply_snippet: bodyText.substring(0, 200),
            reply_sentiment: sentimentResult?.sentiment,
            reply_analyzed_at: sentimentResult ? new Date() : undefined,
          },
        });

        // Increment Campaign emails_replied
        if (matchedOutreachItem.campaign) {
          await prismadb.crm_Outreach_Campaigns.update({
            where: { id: matchedOutreachItem.campaign },
            data: { emails_replied: { increment: 1 } },
          }).catch(() => {});
        }
        systemLogger.info(`[SES_INBOUND] ✅ Matched reply from ${fromAddress} to outreach item ${matchedOutreachItem.id}`);

        // Trigger AI auto-reply if enabled (fire-and-forget)
        if (campaignRecord?.auto_reply_enabled && !sentimentResult?.decision?.stopContact &&
            !sentimentResult?.decision?.automated && !sentimentResult?.decision?.requiresReview) {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm.basalthq.com";
          fetch(`${appUrl}/api/outreach/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              outreachItemId: matchedOutreachItem.id,
              inboundThreadId: newThread.id,
              campaignId: matchedOutreachItem.campaign,
              sentiment: sentimentResult?.sentiment || "UNKNOWN",
            }),
          }).catch((err) => {
            systemLogger.error("[SES_INBOUND] Auto-reply trigger failed:", err);
          });
        }
      } else {
        systemLogger.info(`[SES_INBOUND] Received email from ${fromAddress}, no outreach match (In-Reply-To: ${inReplyTo})`);
      }

      return new NextResponse("OK", { status: 200 });
    }

    return new NextResponse("OK", { status: 200 });

  } catch (error) {
    systemLogger.error("[SES_INBOUND_ERROR]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

/**
 * Parse the actual reply body from raw MIME email content.
 * Extracts text/plain (preferred) or text/html, decodes base64/quoted-printable.
 * Strips the quoted original message (everything after "On ... wrote:").
 */
function parseEmailBody(rawContent?: string): string {
  if (!rawContent) return "(No content)";

  try {
    // Try to extract text/plain part from multipart MIME
    const textPlainMatch = rawContent.match(
      /Content-Type:\s*text\/plain[^\r\n]*\r?\n(?:Content-Transfer-Encoding:\s*(base64|quoted-printable|7bit|8bit)\r?\n)?(?:\r?\n)([\s\S]*?)(?:\r?\n--|\r?\n\r?\n--)/i
    );

    if (textPlainMatch) {
      const encoding = textPlainMatch[1]?.toLowerCase();
      let content = textPlainMatch[2];

      if (encoding === "base64") {
        try {
          content = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf-8");
        } catch { /* use raw */ }
      } else if (encoding === "quoted-printable") {
        content = decodeQuotedPrintable(content);
      }

      // Strip quoted original message
      return stripQuotedReply(content).trim() || content.trim();
    }

    // Try to extract text/html and strip tags
    const textHtmlMatch = rawContent.match(
      /Content-Type:\s*text\/html[^\r\n]*\r?\n(?:Content-Transfer-Encoding:\s*(base64|quoted-printable|7bit|8bit)\r?\n)?(?:\r?\n)([\s\S]*?)(?:\r?\n--|\r?\n\r?\n--)/i
    );

    if (textHtmlMatch) {
      const encoding = textHtmlMatch[1]?.toLowerCase();
      let content = textHtmlMatch[2];

      if (encoding === "base64") {
        try {
          content = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf-8");
        } catch { /* use raw */ }
      } else if (encoding === "quoted-printable") {
        content = decodeQuotedPrintable(content);
      }

      // Strip HTML tags but preserve some structure
      const text = content
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/p>/gi, "\n\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      return stripQuotedReply(text).trim() || text.trim();
    }

    // If not multipart, just return a cleaned version
    return rawContent.substring(0, 2000);
  } catch {
    return rawContent.substring(0, 2000);
  }
}

/** Decode quoted-printable encoding */
function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Strip the quoted/forwarded original message from a reply */
function stripQuotedReply(text: string): string {
  // Gmail: "On Mon, Mar 23, 2026 at 11:41 AM ... wrote:"
  const gmailPattern = /\r?\nOn\s+.+wrote:\s*\r?\n/i;
  // Outlook: "From: ... Sent: ... To: ... Subject: ..."
  const outlookPattern = /\r?\n_{3,}\r?\n/;
  // Generic: lines starting with ">"
  const quoteLinePattern = /^>.*$/gm;

  let stripped = text;

  // Cut at Gmail-style quote
  const gmailIdx = stripped.search(gmailPattern);
  if (gmailIdx > 0) stripped = stripped.substring(0, gmailIdx);

  // Cut at Outlook-style separator
  const outlookIdx = stripped.search(outlookPattern);
  if (outlookIdx > 0) stripped = stripped.substring(0, outlookIdx);

  // Remove remaining ">" quoted lines
  stripped = stripped.replace(quoteLinePattern, "").trim();

  return stripped;
}
