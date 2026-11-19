import { NextResponse } from "next/server";
import crypto from "crypto";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { safeFetch } from "@/lib/security/ssrf-guard";
import { getAiSdkModel, logAiUsage } from "@/lib/varuni";
import { generateObject } from "ai";
import { z } from "zod";
import { sendTeamEmail } from "@/lib/email/team-mailer";
import { buildOutreachPrompt } from "@/lib/outreach/prompt-builder";
import { render } from "@react-email/render";
import OutreachTemplate from "@/emails/OutreachTemplate";
import React from "react";
import { systemLogger } from "@/lib/logger";
import { checkUsageQuota, recordUsage } from "@/lib/usage-quota";

export const maxDuration = 60;

function isValidInternalCall(req: Request): boolean {
    const expected =
        process.env.SYNTHESIS_SECRET ||
        process.env.CRON_SECRET ||
        process.env.JWT_SECRET ||
        "";
    const provided = req.headers.get("x-internal-secret")?.trim() || "";
    if (!expected || !provided) return false;
    const a = Buffer.from(provided, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * POST /api/outreach/reply
 * Generates and sends an AI-powered reply to an inbound email.
 * Requires either a valid x-internal-secret header or an authenticated session owning the campaign.
 */
export async function POST(req: Request) {
    try {
        const isInternal = isValidInternalCall(req);
        let sessionTeamInfo: Awaited<ReturnType<typeof getSessionAndTeam>>["teamInfo"] = null;
        if (!isInternal) {
            const { error, teamInfo } = await getSessionAndTeam();
            if (error) return error;
            sessionTeamInfo = teamInfo;
        }

        const { outreachItemId, inboundThreadId, campaignId, sentiment } = await req.json();

        if (!outreachItemId || !campaignId) {
            return NextResponse.json({ error: "Missing required IDs" }, { status: 400 });
        }

        // ── Load campaign with auto-reply config ───────────────────────────
        const campaign = await prismadb.crm_Outreach_Campaigns.findUnique({
            where: { id: campaignId },
            select: {
                id: true,
                name: true,
                team_id: true,
                user: true,
                auto_reply_enabled: true,
                auto_reply_max_count: true,
                auto_reply_prompt: true,
                prompt_override: true,
                meeting_link: true,
                campaign_branding: true,
                resource_links: true,
                signature_html: true,
                document_ids: true,
            },
        });

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        if (
            !isInternal &&
            !validateResourceOwnership(
                sessionTeamInfo!.teamId,
                campaign.team_id,
                sessionTeamInfo!.isPlatformAdmin
            )
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!campaign.auto_reply_enabled) {
            return NextResponse.json({ status: "skipped", reason: "auto_reply_disabled" });
        }




        // ── Email Quota Enforcement (auto-replies count against email limit) ──
        if (campaign.team_id) {
            const quotaCheck = await checkUsageQuota(campaign.team_id, campaign.user, "email");
            if (!quotaCheck.allowed) {
                systemLogger.warn(`[AUTO_REPLY] Email quota exceeded for team ${campaign.team_id}, skipping reply`);
                return NextResponse.json({ error: quotaCheck.message, skipped: true }, { status: 429 });
            }
        }

        // ── Load outreach item ─────────────────────────────────────────────
        const outreachItem = await prismadb.crm_Outreach_Items.findUnique({
            where: { id: outreachItemId },
            select: {
                id: true,
                campaign: true,
                lead: true,
                auto_reply_count: true,
                subject: true,
                body_text: true,
                candidate_email: true,
                candidate_name: true,
                candidate_company: true,
                candidate_job_title: true,
                sender_email: true,
            },
        });

        if (!outreachItem || outreachItem.campaign !== campaign.id) {
            return NextResponse.json({ error: "Outreach item not found for campaign" }, { status: 404 });
        }

        // Check max reply count
        const maxReplies = campaign.auto_reply_max_count ?? 3;
        if ((outreachItem.auto_reply_count ?? 0) >= maxReplies) {
            return NextResponse.json({ status: "skipped", reason: "max_replies_reached" });
        }

        // ── Load lead if exists ────────────────────────────────────────────
        let leadData: any = null;
        if (outreachItem.lead) {
            leadData = await prismadb.crm_Leads.findUnique({
                where: { id: outreachItem.lead },
                select: {
                    firstName: true,
                    lastName: true,
                    company: true,
                    jobTitle: true,
                    email: true,
                    accountsIDs: true,
                },
            });
        }

        const contactName = leadData
            ? [leadData.firstName, leadData.lastName].filter(Boolean).join(" ")
            : outreachItem.candidate_name || "";
        const contactEmail = leadData?.email || outreachItem.candidate_email || "";
        const contactCompany = leadData?.company || outreachItem.candidate_company || "";
        const contactTitle = leadData?.jobTitle || outreachItem.candidate_job_title || "";

        // ── Load inbound message ───────────────────────────────────────────
        let inboundMessage = "";
        if (inboundThreadId) {
            const inbound = await prismadb.crm_Email_Thread.findFirst({
                where: {
                    id: inboundThreadId,
                    ...(campaign.team_id ? { team_id: campaign.team_id } : { outreach_item: outreachItem.id }),
                },
                select: { body_text: true, from_email: true },
            });
            inboundMessage = inbound?.body_text || "";
        }

        // ── Load conversation history ──────────────────────────────────────
        const threads = await prismadb.crm_Email_Thread.findMany({
            where: { outreach_item: outreachItemId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { direction: true, body_text: true, subject: true, createdAt: true },
        });

        const conversationHistory = threads.map((t: any) => {
            const dir = t.direction === "INBOUND" ? "LEAD" : "US";
            const snippet = (t.body_text || "").substring(0, 300);
            return `[${dir}] ${t.subject || ""}: ${snippet}`;
        });

        // ── Load sender info ───────────────────────────────────────────────
        let senderName = "Team";
        let senderTitle = "";
        if (campaign.user) {
            const senderUser = await prismadb.users.findUnique({
                where: { id: campaign.user },
                select: { name: true },
            });
            senderName = senderUser?.name || senderName;
        }

        // ── Load brand identity ────────────────────────────────────────────
        let brandIdentity = null;
        const branding = campaign.campaign_branding as any;
        if (branding?.company_name) {
            brandIdentity = branding;
        } else {
            brandIdentity = await prismadb.teamBrandIdentity.findFirst({
                where: { team_id: campaign.team_id, is_default: true },
            });
        }

        // ── Load campaign documents metadata (strictly scoped to campaign.team_id) ──
        let availableDocuments: { name: string; type?: string; id: string }[] = [];
        if (campaign.document_ids?.length && campaign.team_id) {
            const docs = await prismadb.documents.findMany({
                where: { id: { in: campaign.document_ids }, team_id: campaign.team_id },
                select: { id: true, document_name: true, document_file_mimeType: true, document_file_url: true },
            });
            availableDocuments = docs.map((d: any) => ({
                id: d.id,
                name: d.document_name || "Untitled Document",
                type: d.document_file_mimeType || undefined,
            }));
        }

        // ── Parse resource links ───────────────────────────────────────────
        let availableResources: { label: string; url: string }[] = [];
        const rawResources = campaign.resource_links;
        if (Array.isArray(rawResources)) {
            availableResources = rawResources
                .filter((r: any) => r?.label && r?.url)
                .map((r: any) => ({ label: r.label, url: r.url }));
        }

        // Effective meeting link: campaign only (meeting_link is on campaigns, not users)
        const effectiveMeetingLink = campaign.meeting_link || null;

        // ── Build the prompt ───────────────────────────────────────────────
        const replyPrompt = buildOutreachPrompt({
            basePrompt: campaign.auto_reply_prompt || campaign.prompt_override || null,
            contact: {
                name: contactName || undefined,
                company: contactCompany || undefined,
                jobTitle: contactTitle || undefined,
                email: contactEmail || undefined,
            },
            sender: { name: senderName, title: senderTitle },
            companyResearch: null,
            meetingLink: effectiveMeetingLink,
            channel: "REPLY",
            brandIdentity,
            inboundMessage,
            conversationHistory,
            availableDocuments: availableDocuments.map((d) => ({ name: d.name, type: d.type })),
            availableResources,
        });

        // ── AI generation ──────────────────────────────────────────────────
        const userId = campaign.user || undefined;
        const { model, modelId, teamId } = await getAiSdkModel(userId || "system");
        if (!model) {
            return NextResponse.json({ error: "AI model not configured" }, { status: 500 });
        }

        const { object, usage } = await generateObject({
            model,
            schema: z.object({
                subject: z.string().describe("Email subject line"),
                body: z.string().describe("Plain text email body"),
                attachDocuments: z.boolean().describe("Whether campaign documents should be attached to this reply (e.g., pricing sheets, agreements, case studies). Set true when the lead asks for more info, pricing, or materials."),
                attachmentReason: z.string().optional().describe("Brief reason for attaching or not attaching documents"),
                scheduleMeeting: z.boolean().describe("Whether to include a meeting scheduling link or propose meeting times. Set true when the lead expresses interest in a call, demo, or meeting."),
                leadQualified: z.boolean().describe("Whether this lead appears genuinely interested and should be promoted to an Opportunity. Set true when the lead shows clear buying signals: asks about pricing, wants a demo, discusses timelines, or expresses intent to purchase/partner."),
                qualifiedReason: z.string().optional().describe("Brief reason for why the lead is or isn't qualified"),
            }),
            messages: [
                {
                    role: "system",
                    content: `You are a professional outreach specialist replying to an inbound email. Return ONLY JSON with the specified schema.
The 'body' must be plain text (no HTML).
IMPORTANT: The email template automatically includes the sender's signature and resource buttons — do NOT write them in the body. Just write the conversational reply text.
If a meeting link is available and relevant, mention it naturally in the body (e.g., "Feel free to book a time here: [link]").
If campaign documents are available and the lead is asking for materials/pricing/info, set attachDocuments to true.
If the lead shows genuine buying interest (pricing questions, timeline discussions, demo requests), set leadQualified to true.

${sentiment === "NEGATIVE" ? `IMPORTANT — NEGATIVE SENTIMENT DETECTED: The lead has expressed disinterest or declined. Write a brief, gracious reply thanking them for their time. Do NOT pitch, push, or try to overcome objections. Simply acknowledge their decision, wish them well, and leave the door open in case their needs change in the future. Keep it to 2-3 sentences max. Set leadQualified to false and attachDocuments to false.` : sentiment === "NEUTRAL" ? `NOTE — NEUTRAL SENTIMENT: The lead's response is ambiguous or non-committal. Be helpful and conversational but not pushy. Ask a gentle clarifying question if appropriate. Set leadQualified to false — do NOT promote neutral replies to opportunities. Only set attachDocuments to true if they explicitly ask for materials.` : `The lead appears interested. Engage warmly and move the conversation forward.`}`,
                },
                { role: "user", content: replyPrompt },
            ],
        });

        const replySubject = object.subject || `Re: ${outreachItem.subject || "Your inquiry"}`;
        let replyBody = object.body || "Thank you for your response. I'd love to connect further.";

        // ── Append meeting link if AI wants to schedule ────────────────────
        if (object.scheduleMeeting && effectiveMeetingLink && !replyBody.includes(effectiveMeetingLink)) {
            replyBody += `\n\nBook a time that works for you: ${effectiveMeetingLink}`;
        }

        // ── Log AI usage ───────────────────────────────────────────────────
        await logAiUsage({
            teamId: teamId || campaign.team_id,
            userId: userId || "system",
            service: "email",
            model: modelId || "unknown",
            usage: {
                promptTokens: (usage as any)?.promptTokens || 0,
                completionTokens: (usage as any)?.completionTokens || 0,
            },
            description: `Auto-reply for campaign: ${campaign.name}`,
        });

        // ── Render HTML email with signature + resources ───────────────────
        const html = await render(
            React.createElement(OutreachTemplate, {
                subjectPreview: replySubject,
                bodyText: replyBody,
                resources: campaign.resource_links as any || [],
                signatureHtml: campaign.signature_html || undefined,
                brand: { accentColor: (branding?.primary_brand_color) || "#6366f1", primaryText: "#1f2937" },
            })
        );

        // ── Prepare attachments if AI flagged ──────────────────────────────
        let attachments: { filename: string; content: any; contentType?: string }[] = [];
        if (object.attachDocuments && availableDocuments.length > 0 && campaign.team_id) {
            systemLogger.info(`[AUTO_REPLY] AI requested document attachment for ${outreachItem.id}. Reason: ${object.attachmentReason || "N/A"}`);
            try {
                const docs = await prismadb.documents.findMany({
                    where: { id: { in: campaign.document_ids }, team_id: campaign.team_id },
                    select: { id: true, document_name: true, document_file_mimeType: true, document_file_url: true },
                });
                for (const doc of docs) {
                    if (doc.document_file_url) {
                        try {
                            const resp = await safeFetch(doc.document_file_url);
                            if (resp.ok) {
                                const buffer = Buffer.from(await resp.arrayBuffer());
                                attachments.push({
                                    filename: doc.document_name || "document",
                                    content: buffer,
                                    contentType: doc.document_file_mimeType || "application/octet-stream",
                                });
                            }
                        } catch (err: any) {
                            systemLogger.error(`[AUTO_REPLY] Failed to fetch document ${doc.id}: ${err?.message || err}`);
                        }
                    }
                }
            } catch (err: any) {
                systemLogger.error(`[AUTO_REPLY] Failed to load documents for attachment: ${err?.message || err}`);
            }
        }

        // ── Resolve original sender for From and Reply-To ────────────────
        // The auto-reply MUST come from the same email that sent the original outreach
        let senderFromEmail: string | null = null;
        let senderFromName = senderName;

        // Try sender_email on the outreach item first
        if ((outreachItem as any).sender_email) {
            senderFromEmail = (outreachItem as any).sender_email;
        }

        // Fall back to campaign user's email
        if (!senderFromEmail && campaign.user) {
            const senderUser = await prismadb.users.findUnique({
                where: { id: campaign.user },
                select: { email: true, name: true },
            });
            if (senderUser?.email) {
                senderFromEmail = senderUser.email;
                senderFromName = senderUser.name || senderFromName;
            }
        }

        // Build reply-to using the sender's email prefix
        const replyDomainConfig = await prismadb.teamEmailConfig.findFirst({
            where: { team_id: campaign.team_id },
            select: { reply_domain: true, reply_domain_status: true },
        });
        const replyDomain = (replyDomainConfig?.reply_domain && replyDomainConfig.reply_domain_status === "VERIFIED")
            ? replyDomainConfig.reply_domain
            : "reply.basalthq.com";

        // Use sender's email prefix for reply-to (e.g., mmilton@basalthq.com → mmilton@reply.basalthq.com)
        const senderPrefix = senderFromEmail ? senderFromEmail.split("@")[0] : "sysadm";
        const replyToAddress = `${senderPrefix}@${replyDomain}`;

        // Build the from address override
        const fromOverride = senderFromEmail
            ? `"${senderFromName}" <${senderFromEmail}>`
            : undefined;

        // ── Send the reply email ───────────────────────────────────────────
        const messageId = await sendTeamEmail(campaign.team_id, {
            ...(fromOverride ? { from: fromOverride } : {}),
            to: contactEmail,
            subject: replySubject,
            html,
            text: replyBody,
            replyTo: replyToAddress,
            ...(attachments.length > 0 ? { attachments } : {}),
        }, "OUTREACH");

        const cleanedMessageId = messageId?.replace(/[<>]/g, "").trim() || null;

        // ── Create outbound thread entry ───────────────────────────────────
        await prismadb.crm_Email_Thread.create({
            data: {
                team_id: campaign.team_id,
                user: campaign.user || undefined,
                lead: outreachItem.lead || undefined,
                campaign: campaign.id,
                outreach_item: outreachItem.id,
                thread_subject: replySubject,
                message_id: cleanedMessageId || `auto_reply_${Date.now()}`,
                direction: "OUTBOUND",
                from_email: replyToAddress,
                to_email: contactEmail,
                subject: replySubject,
                body_text: replyBody,
                receivedAt: new Date(),
            } as any,
        });

        // ── Increment auto_reply_count ─────────────────────────────────────
        await prismadb.crm_Outreach_Items.update({
            where: { id: outreachItem.id },
            data: {
                auto_reply_count: { increment: 1 },
            },
        });

        // ── Log activity ───────────────────────────────────────────────────
        if (outreachItem.lead) {
            await prismadb.crm_Lead_Activities.create({
                data: {
                    lead: outreachItem.lead,
                    user: campaign.user || undefined,
                    type: "AUTO_REPLY_SENT",
                    metadata: {
                        campaignId: campaign.id,
                        subject: replySubject,
                        messageId: cleanedMessageId,
                        attachedDocuments: object.attachDocuments,
                        scheduledMeeting: object.scheduleMeeting,
                        leadQualified: object.leadQualified,
                    } as any,
                },
            }).catch(() => {});
        }

        // ── Opportunity Promotion ──────────────────────────────────────────
        // Only create opportunities for POSITIVE sentiment with AI-confirmed buying signals
        if (object.leadQualified && sentiment === "POSITIVE" && outreachItem.lead) {
            try {
                // Check if an opportunity already exists for this lead from this outreach campaign
                const existingOpp = await prismadb.crm_Opportunities.findFirst({
                    where: {
                        lead_id: outreachItem.lead,
                        team_id: campaign.team_id,
                        lead_source: "outreach_campaign",
                        description: { contains: campaign.id },
                    },
                });

                if (!existingOpp) {
                    // Get first sales stage (global, not team-scoped)
                    const firstStage = await prismadb.crm_Opportunities_Sales_Stages.findFirst({
                        orderBy: { order: "asc" },
                    });

                    await prismadb.crm_Opportunities.create({
                        data: {
                            name: `${contactName || contactEmail} - ${campaign.name}`,
                            description: `${object.qualifiedReason || "Auto-promoted"} [outreach_campaign:${campaign.id}]`,
                            lead_id: outreachItem.lead,
                            account: leadData?.accountsIDs || undefined,
                            assigned_to: campaign.user || undefined,
                            created_by: campaign.user || undefined,
                            team_id: campaign.team_id,
                            sales_stage: firstStage?.id || undefined,
                            status: "ACTIVE",
                            lead_source: "outreach_campaign",
                            expected_revenue: 0,
                            budget: 0,
                        } as any,
                    });

                    // Log opportunity creation activity
                    await prismadb.crm_Lead_Activities.create({
                        data: {
                            lead: outreachItem.lead,
                            user: campaign.user || undefined,
                            type: "OPPORTUNITY_CREATED",
                            metadata: {
                                campaignId: campaign.id,
                                reason: object.qualifiedReason || "AI detected buying signals",
                                source: "auto_reply_agent",
                            } as any,
                        },
                    }).catch(() => {});

                    systemLogger.info(`[AUTO_REPLY] 🎯 Created Opportunity for lead ${outreachItem.lead} from campaign ${campaign.name}. Reason: ${object.qualifiedReason || "AI qualified"}`);
                }
            } catch (oppError: any) {
                systemLogger.error(`[AUTO_REPLY] Failed to create opportunity: ${oppError?.message || oppError}`);
            }
        }

        systemLogger.info(`[AUTO_REPLY] ✅ Sent auto-reply for outreach item ${outreachItem.id}, campaign ${campaign.name}. Docs attached: ${object.attachDocuments}, Meeting: ${object.scheduleMeeting}, Qualified: ${object.leadQualified}`);

        return NextResponse.json({
            status: "sent",
            outreachItemId: outreachItem.id,
            subject: replySubject,
            messageId: cleanedMessageId,
            attachedDocuments: object.attachDocuments,
            scheduledMeeting: object.scheduleMeeting,
            leadQualified: object.leadQualified,
        });

    } catch (error: any) {
        systemLogger.error("[AUTO_REPLY_ERROR]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
