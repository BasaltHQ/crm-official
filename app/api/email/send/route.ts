import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sendEmail from "@/lib/sendmail";
import { prismadb } from "@/lib/prisma";
import crypto from "crypto";
import { systemLogger } from "@/lib/logger";
import { getGmailClientForUser } from "@/lib/gmail";
import { getGraphClient } from "@/lib/microsoft";
import { checkWarmupQuota, recordWarmupSend } from "@/lib/email-warmup";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session) {
        return new NextResponse("Unauthenticated", { status: 401 });
    }

    try {
        const body = await req.json();
        const { to, subject, text, isHtml, leadId, contactId, accountId, trackClicks, trackOpens } = body;

        if (!to || !subject || !text) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const userId = session.user.id;
        const trackingToken = crypto.randomBytes(16).toString("hex");
        const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

        let processedHtml = isHtml ? text : text.replace(/\n/g, '<br/>');

        // 1. CTR Tracking (Link Wrapping)
        if (trackClicks) {
            processedHtml = processedHtml.replace(
                /href=["'](https?:\/\/[^"']+)["']/gi,
                (match: string, url: string) => `href="${baseUrl}/api/email/track/click?token=${trackingToken}&url=${encodeURIComponent(url)}"`
            );
            // Fallback for plain text links not in HTML tags if not in HTML mode
            if (!isHtml) {
                // To avoid messing up newly added hrefs or tags, we do a basic replace only outside tags,
                // but since it's tricky, we'll only do it if the string doesn't start with <a 
                // Alternatively, just let HTML mode handle tags and text mode handle raw URLs.
                // Since text mode replaces \n with <br/>, raw URLs would just be text. Let's wrap raw URLs in <a> tags.
                processedHtml = processedHtml.replace(
                    /(^|[^"'])(https?:\/\/[^\s<]+)/gi,
                    (match: string, prefix: string, url: string) => {
                        // Don't wrap if it's already inside an href
                        if (prefix === '=' || prefix === '"' || prefix === "'") return match;
                        const trackingUrl = `${baseUrl}/api/email/track/click?token=${trackingToken}&url=${encodeURIComponent(url)}`;
                        return `${prefix}<a href="${trackingUrl}">${url}</a>`;
                    }
                );
            }
        }

        // 2. Open Tracking (Pixel)
        if (trackOpens) {
            processedHtml += `<img src="${baseUrl}/api/email/track/open?token=${trackingToken}" width="1" height="1" style="display:none;" />`;
        }

        // 3. Log Activity to CRM
        let targetLeadId = leadId;

        // If no leadId provided, try to find one by email
        if (!targetLeadId && to) {
            const lead = await prismadb.crm_Leads.findFirst({
                where: { email: to }
            });
            if (lead) targetLeadId = lead.id;
        }

        if (targetLeadId) {
            await prismadb.crm_Lead_Activities.create({
                data: {
                    lead: targetLeadId,
                    user: userId,
                    type: "EMAIL",
                    metadata: {
                        subject,
                        trackingToken,
                        recipient: to
                    }
                }
            });

            // Also create an Outreach Item for detailed tracking
            let adhocCampaign = await prismadb.crm_Outreach_Campaigns.findFirst({
                where: { name: "Ad-hoc Emails", user: userId }
            });

            if (!adhocCampaign) {
                adhocCampaign = await prismadb.crm_Outreach_Campaigns.create({
                    data: {
                        name: "Ad-hoc Emails",
                        user: userId,
                        status: "ACTIVE",
                        v: 0
                    }
                });
            }

            await prismadb.crm_Outreach_Items.create({
                data: {
                    campaign: adhocCampaign.id,
                    lead: targetLeadId,
                    channel: "EMAIL",
                    status: "SENT",
                    subject,
                    body_text: text,
                    body_html: processedHtml,
                    tracking_token: trackingToken,
                    sentAt: new Date(),
                    v: 0
                }
            });
        }

        // 4. Dispatch Email natively or via SES fallback
        const gmailClient = await getGmailClientForUser(userId);
        const graphClient = !gmailClient ? await getGraphClient(userId) : null;

        // Resolve the sender email for warm-up tracking
        const userRecord = await prismadb.users.findUnique({
            where: { id: userId },
            select: { email: true, team_id: true },
        });
        let senderEmailForWarmup = userRecord?.email || session.user.email || '';
        if (gmailClient) {
            // Gmail: sender is the user's Google email (same as session email)
        } else if (graphClient) {
            // Microsoft: sender is the user's Outlook email
        } else {
            // SES fallback: use the configured FROM address
            senderEmailForWarmup = process.env.EMAIL_FROM || process.env.EMAIL_USERNAME || senderEmailForWarmup;
        }

        // ── Email Warm-Up Enforcement ──
        if (userRecord?.team_id) {
            const warmupCheck = await checkWarmupQuota(userRecord.team_id, senderEmailForWarmup);
            if (!warmupCheck.allowed) {
                return NextResponse.json(
                    { error: warmupCheck.message || `Warm-up daily limit reached (${warmupCheck.sentToday}/${warmupCheck.dailyLimit}).`, warmup: warmupCheck },
                    { status: 429 }
                );
            }
        }

        if (gmailClient) {
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `To: ${to}`,
                `Subject: ${utf8Subject}`,
                "Content-Type: text/html; charset=utf-8",
                "MIME-Version: 1.0",
                "",
                processedHtml
            ];
            
            const messageContent = messageParts.join("\r\n");
            const encodedMessage = Buffer.from(messageContent)
                .toString("base64")
                .replace(/\+/g, "-")
                .replace(/\//g, "_")
                .replace(/=+$/, "");

            const res = await gmailClient.users.messages.send({
                userId: "me",
                requestBody: { raw: encodedMessage }
            });

            // Log into CRM Emails
            await prismadb.crm_Emails.create({
                data: {
                    user_id: userId,
                    provider: 'google',
                    message_id: res.data.id || `local-${Date.now()}`,
                    subject: subject,
                    snippet: text.substring(0, 100),
                    to_emails: [{ email: to }],
                    is_inbound: false,
                    is_read: true,
                    date: new Date(),
                    lead_id: targetLeadId,
                    contact_id: contactId,
                } as any
            });

        } else if (graphClient) {
            const messagePayload = {
                message: {
                    subject: subject,
                    body: {
                        contentType: "HTML",
                        content: processedHtml
                    },
                    toRecipients: [{ emailAddress: { address: to } }]
                },
                saveToSentItems: "true"
            };

            await graphClient.api('/me/sendMail').post(messagePayload);

            // Log into CRM Emails
            await prismadb.crm_Emails.create({
                data: {
                    user_id: userId,
                    provider: 'microsoft',
                    message_id: `ms-${Date.now()}`,
                    subject: subject,
                    snippet: text.substring(0, 100),
                    to_emails: [{ email: to }],
                    is_inbound: false,
                    is_read: true,
                    date: new Date(),
                    lead_id: targetLeadId,
                    contact_id: contactId,
                } as any
            });

        } else {
            // Fallback to SES
            await sendEmail({
                from: process.env.EMAIL_FROM,
                to,
                subject,
                text, // Plain text fallback
                html: processedHtml,
            });
        }

        // ── Record Warm-Up Send ──
        if (userRecord?.team_id) {
            await recordWarmupSend(userRecord.team_id, senderEmailForWarmup).catch((e: any) =>
                systemLogger.error("[EMAIL_SEND] Failed to record warm-up send:", e?.message)
            );
        }

        return NextResponse.json({ message: "Email sent successfully", token: trackingToken });
    } catch (error) {
        systemLogger.error("[EMAIL_SEND_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
