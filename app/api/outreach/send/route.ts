import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { sendTeamEmail } from "@/lib/email/team-mailer";
import sendSystemEmail from "@/lib/sendmail";
import { render } from "@react-email/render";
import OutreachTemplate, { type ResourceLink } from "@/emails/OutreachTemplate";
import { getAiSdkModel, logAiUsage } from "@/lib/varuni";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { sendViaGmail } from "@/lib/gmail";
import React from "react";
import { ensureContactForLead } from "@/actions/crm/lead-conversions";
import { ensureLeadAndAccountForCandidate } from "@/actions/crm/ensure-pipeline";
import { claimOnboardingBonus } from "@/actions/crm/onboarding-bonus";
import { systemLogger } from "@/lib/logger";
import { checkUsageQuota, recordUsage } from "@/lib/usage-quota";
import { checkWarmupQuota, recordWarmupSend } from "@/lib/email-warmup";


import { researchCompany } from "@/lib/outreach/company-research";
import { renderOutreachTemplate } from "@/lib/outreach/outreach-templates";
import { resolveIconUrl, inferIconFromResource } from "@/lib/outreach/outreach-icons";

/**
 * POST /api/outreach/send
 * Body: {
 *   leadIds: string[];
 *   test?: boolean;
 *   promptOverride?: string;
 *   meetingLinkOverride?: string;
 * }
 *
 * Behavior:
 * - Loads leads (scoped to current user unless admin).
 * - For each lead, generates a personalized email (subject/body in plain text) using OpenAI (Azure/OpenAI).
 * - Renders OutreachTemplate (HTML) including resources, signature, and a tracking pixel.
 * - Sends via nodemailer (SMTP) using lib/sendmail.ts.
 * - Updates lead outreach fields and inserts crm_Lead_Activities.
 */

type RequestBody = {
  leadIds: string[];
  test?: boolean;
  testEmail?: string;
  inlineLeads?: Array<{ id: string; firstName?: string; lastName?: string; company?: string; jobTitle?: string; email?: string; additional_emails?: string[] }>;
  promptOverride?: string;
  meetingLinkOverride?: string;
  brandId?: string;
  senderMode?: "company" | "personal";
  signatureSource?: "user" | "brand";
  senderOverride?: { name?: string; title?: string } | null; // Override sender identity for AI ghostwriting
  // Pre-generated content to skip AI regeneration (for test sends using preview)
  preGeneratedSubject?: string;
  preGeneratedBody?: string;
  preGeneratedHtml?: string;
  templateId?: string;
  themeColorOverride?: string;
  secondaryColorOverride?: string;
  leadData?: Array<{ id: string; firstName?: string; lastName?: string; company?: string; jobTitle?: string; email?: string; additional_emails?: string[] }>;
  templateOptions?: import("@/lib/outreach/outreach-styles").TemplateOptions;
  campaignId?: string;  // Links sent emails to a crm_Outreach_Campaigns record
  poolId?: string;      // Source pool for pipeline provisioning
  followupConfig?: {
    enabled: boolean;
    delayHours: number;
    maxCount: number;
    prompt?: string;
  };
};


// Default generic resource configuration if user has none
const DEFAULT_RESOURCES: ResourceLink[] = [
  { id: "website", label: "Visit Website", href: "#", type: "primary", enabled: true },
  { id: "calendar", label: "Schedule a Call", href: "#", type: "primary", enabled: true },
  { id: "linkedin", label: "Follow on LinkedIn", href: "#", type: "secondary", enabled: true }
];

// Lightweight HTML stripper for plaintext fallback
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}

// Compose the strict system instruction to force JSON output
function systemInstruction(senderName?: string, senderTitle?: string, recipientFirstName?: string) {
  const name = senderName || "the sender";
  const titlePart = senderTitle ? ` (${senderTitle})` : "";
  const greetingInstruction = recipientFirstName
    ? `The body MUST start with a proper greeting addressing the recipient by first name (e.g. 'Hi ${recipientFirstName},' or 'Dear ${recipientFirstName},').`
    : `The body MUST start with a professional greeting. If the recipient's name is unknown, use a warm generic opening (e.g. 'Hi there,' or 'Hello,').`;
  return [
    `You are ghostwriting a personalized outreach email ON BEHALF of ${name}${titlePart}.`,
    `Write in first person (I/me) as ${name}. Never refer to ${name} in third person.`,
    "Return ONLY JSON with keys 'subject' and 'body'.",
    "The 'body' must be plain text (no HTML), 250–300 words.",
    greetingInstruction,
    `The body MUST end with a professional sign-off that fits the email tone (e.g. Sincerely, Regards, Cheers, Looking forward) followed by the sender's name: ${name}.`,
    "Do not include headings or phrases like 'Founder note'.",
  ].join(" ");
}

import { buildOutreachPrompt } from "@/lib/outreach/prompt-builder";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = (await req.json()) as RequestBody;
    if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
      return new NextResponse("No leads provided", { status: 400 });
    }

    // Check current user (for admin privileges)
    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        is_admin: true,
        is_account_admin: true,
        meeting_link: true,
        signature_html: true,
        resource_links: true,
        outreach_prompt_default: true,
        team_id: true,
        assigned_team: { select: { parent_id: true } }
      },
    });

    if (!user || !user.team_id) {
      return new NextResponse("User or team not found", { status: 404 });
    }

    // ── Email Quota Enforcement ──
    if (!body.test) {
      const quotaCheck = await checkUsageQuota(user.team_id, user.id, "email", body.leadIds.length);
      if (!quotaCheck.allowed) {
        return NextResponse.json(
          { error: quotaCheck.message, remaining: quotaCheck.remaining, limit: quotaCheck.limit },
          { status: 429 }
        );
      }
    }

    const isAdmin = !!(user.is_admin || user.is_account_admin);


    // ── Campaign ID from the wizard (auto-creation removed — wizard handles this) ────
    let campaignId = body.campaignId || undefined;
    // NOTE: Auto-campaign creation was removed here because the wizard now always
    // creates the campaign via POST /api/campaigns BEFORE calling this route.
    // Keeping auto-creation caused double campaigns and double emails_sent counts.

    // Fetch Team Brand Identity
    let brandIdentity = null;
    if (user.team_id) {
      const targetTeamId = user.assigned_team?.parent_id || user.team_id;
      brandIdentity = await prismadb.teamBrandIdentity.findFirst({
        where: { team_id: targetTeamId, is_default: true },
        select: { logo_url: true, company_name: true, primary_brand_color: true },
      });
    }

    // Fetch leads, scoped by user if not admin
    // Partition IDs: valid Mongo ObjectIDs vs compound candidate IDs (e.g., "candidateId_contactId")
    const validObjectIds = body.leadIds.filter((id: string) => /^[a-f0-9]{24}$/i.test(id));
    const candidateIds = body.leadIds.filter((id: string) => !/^[a-f0-9]{24}$/i.test(id));

    systemLogger.info(`[OUTREACH_SEND] Query: leadIds=${body.leadIds.length} (${validObjectIds.length} valid, ${candidateIds.length} candidates), isAdmin=${isAdmin}, userId=${session.user.id}, teamId=${user.team_id}`);
    
    let dbLeads: any[] = [];
    if (validObjectIds.length > 0) {
      dbLeads = await prismadb.crm_Leads.findMany({
        where: {
          id: { in: validObjectIds },
          ...(isAdmin ? {} : { assigned_to: session.user.id }),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          company: true,
          jobTitle: true,
          email: true,
          additional_emails: true,
          assigned_to: true,
          outreach_meeting_link: true,
          outreach_status: true,
        },
      });
    }

    systemLogger.info(`[OUTREACH_SEND] Found ${dbLeads.length} leads from DB. Candidate IDs: ${candidateIds.length}`);

    // For candidate IDs, use client-supplied leadData or inlineLeads (pool candidates aren't in crm_Leads)
    const candidateLeads: any[] = [];
    const clientData = body.leadData || body.inlineLeads || [];

    // Also check for valid ObjectIDs that weren't found in crm_Leads (e.g. pool/account entries)
    const foundDbIds = new Set(dbLeads.map((l: any) => l.id));
    const missingObjectIds = validObjectIds.filter(id => !foundDbIds.has(id));
    
    // Check which of the missingObjectIds are actually crm_Accounts
    let foundAccountIds = new Set<string>();
    if (missingObjectIds.length > 0) {
      const dbAccounts = await prismadb.crm_Accounts.findMany({
        where: { id: { in: missingObjectIds } },
        select: { id: true },
      });
      foundAccountIds = new Set(dbAccounts.map((a: any) => a.id));
    }

    const allUnresolvedIds = [...candidateIds, ...missingObjectIds];

    if (allUnresolvedIds.length > 0 && Array.isArray(clientData) && clientData.length > 0) {
      systemLogger.info(`[OUTREACH_SEND] Resolving ${allUnresolvedIds.length} unresolved IDs (${candidateIds.length} candidates + ${missingObjectIds.length} missing DB leads) from ${clientData.length} leadData entries`);
      for (const cid of allUnresolvedIds) {
        const match = clientData.find((ld: any) => ld.id === cid);
        if (match) {
          const resolvedEmail = match.email || (match.additional_emails && match.additional_emails[0]) || null;
          systemLogger.info(`[OUTREACH_SEND] Unresolved ID "${cid}" -> match: firstName="${match.firstName}", lastName="${match.lastName}", email="${resolvedEmail}"`);
          if (resolvedEmail) {
            candidateLeads.push({
              id: cid,
              firstName: match.firstName || '',
              lastName: match.lastName || '',
              company: match.company || '',
              jobTitle: match.jobTitle || '',
              email: resolvedEmail,
              additional_emails: (match as any).additional_emails || [],
              assigned_to: null,
              outreach_meeting_link: null,
              outreach_status: 'IDLE',
            });
          }
        }
      }
    }


    let leads: any[] = [...dbLeads, ...candidateLeads];

    if (leads.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0, errors: 0, results: [], message: `No leads found. Requested ${body.leadIds.length} IDs. isAdmin=${isAdmin}` });
    }

    // Move test mode declaration early so we can evaluate target emails
    const testMode = !!body.test;
    const testEmailOverride = body.testEmail?.trim();

    // Flatten leads into recipients
    const recipients: any[] = [];
    for (const lead of leads) {
        if (testMode) {
            // In test mode, we overrides destination emails. We just create ONE recipient per lead.
            const testEmails = (body.testEmail?.trim() || "")
                .split(",")
                .map((e: string) => e.trim())
                .filter((e: string) => e.length > 0 && e.includes("@"));
            const targetEmails = testEmails.length > 0 ? testEmails : [process.env.TEST_EMAIL || session.user.email || ""].filter(Boolean);
            
            for (const te of targetEmails) {
                recipients.push({ ...lead, targetEmail: te, isPrimary: true, isTestRecipient: true });
            }
        } else {
            if (lead.email) {
                recipients.push({ ...lead, targetEmail: lead.email, isPrimary: true });
            }
            if (lead.additional_emails && Array.isArray(lead.additional_emails)) {
                for (const addr of lead.additional_emails) {
                    if (addr && typeof addr === 'string' && addr.includes("@")) {
                        recipients.push({ ...lead, targetEmail: addr, isPrimary: false });
                    }
                }
            }
        }
    }

    // ── Upfront Email-Address Deduplication ──────────────────────────────
    // When a broken import produces duplicate contacts with the same email
    // (e.g. "Philip" and "Philip Ahn" both mapped to philip.ahn@cincyblind.org),
    // we must deduplicate BEFORE entering the send loop. The reactive dedup
    // inside the loop (sentEmailsThisDispatch) only works within a single
    // API call and can miss duplicates in chunked/batched dispatches.
    if (!testMode) {
      const seenEmails = new Set<string>();
      const deduped: any[] = [];
      for (const r of recipients) {
        const key = (r.targetEmail || "").toLowerCase();
        if (!key || seenEmails.has(key)) {
          systemLogger.info(`[OUTREACH_SEND] Upfront dedup: skipping duplicate email "${r.targetEmail}" (Lead ${r.id}, name="${r.firstName} ${r.lastName}")`);
          continue;
        }
        seenEmails.add(key);
        deduped.push(r);
      }
      if (deduped.length < recipients.length) {
        systemLogger.info(`[OUTREACH_SEND] Upfront dedup removed ${recipients.length - deduped.length} duplicate email(s). ${deduped.length} unique recipients remain.`);
      }
      recipients.length = 0;
      recipients.push(...deduped);
    }

    if (recipients.length === 0) {
        return NextResponse.json({ sent: 0, skipped: 0, errors: 0, results: [], message: `No valid recipient emails found for requested leads.` });
    }

    // A subtle compliance: skip contacts with unsubscribed email if we can match them
    // Scoped to the sending team — unsubscribing from Team A doesn't block Team B
    const leadEmails = recipients.map((r: any) => r.targetEmail).filter(Boolean) as string[];
    const unsubscribedContacts = await prismadb.crm_Contacts.findMany({
      where: { email: { in: leadEmails }, team_id: user.team_id },
      select: { email: true, email_unsubscribed: true },
    });
    const unsubSet = new Set(
      unsubscribedContacts.filter((c: any) => c.email_unsubscribed).map((c: any) => (c.email || "").toLowerCase()),
    );

    // Prepare OpenAI client
    const { model, modelId, teamId } = await getAiSdkModel({ userId: session.user.id, teamId: user.team_id || undefined }, "email");
    if (!model) {
      return new NextResponse("AI model not configured", { status: 500 });
    }

    // Base URL for links/pixel — use production URL when running locally so pixels are reachable
    const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const baseUrl = rawBaseUrl.includes("localhost") ? "https://crm.basalthq.com" : rawBaseUrl;

    // User resources/signature (defaults)
    let resources: ResourceLink[] = DEFAULT_RESOURCES;
    try {
      if (user.resource_links && typeof user.resource_links === "object") {
        // resource_links is JSON in DB; Prisma type is unknown (Json)
        resources = (user.resource_links as any) as ResourceLink[];
        if (!Array.isArray(resources)) resources = DEFAULT_RESOURCES;
      }
    } catch {
      resources = DEFAULT_RESOURCES;
    }
    let signatureHtml = user.signature_html || undefined;
    let brandAccentColor = brandIdentity?.primary_brand_color || "#F54029";
    let brandLogoUrl = brandIdentity?.logo_url || undefined;
    let brandCompanyName = brandIdentity?.company_name || undefined;

    // Override with brand-level signature/resources if brandId is provided
    if (body.brandId) {
      try {
        const brand = await prismadb.teamBrandIdentity.findUnique({
          where: { id: body.brandId },
          select: { signature_html: true, resource_links: true, logo_url: true, company_name: true, primary_brand_color: true },
        });
        if (brand?.signature_html && body.signatureSource !== "user") {
          signatureHtml = brand.signature_html;
        }
        if (brand?.resource_links && Array.isArray(brand.resource_links)) {
          resources = brand.resource_links as any as ResourceLink[];
        }
        if (brand?.logo_url) {
          brandLogoUrl = brand.logo_url;
        }
        if (brand?.company_name) {
          brandCompanyName = brand.company_name;
        }
        if (brand?.primary_brand_color) {
          brandAccentColor = brand.primary_brand_color;
        }
      } catch { }
    }

    const meetingLinkOverride = body.meetingLinkOverride?.trim();
    const promptOverride = body.promptOverride?.trim();

    // Pre-generated content (skip AI if provided)
    const preGeneratedSubject = body.preGeneratedSubject?.trim();
    const preGeneratedBody = body.preGeneratedBody?.trim();
    const preGeneratedHtml = body.preGeneratedHtml;

    const results: Array<{
      leadId: string;
      status: "skipped" | "sent" | "error";
      reason?: string;
      subject?: string;
      to?: string;
      messageId?: string;
    }> = [];

    const ensuredPipelineIds = new Map<string, any>();
    let recipientIndex = 0;

    // ── Pre-fetch Global Deduplication Set for the Campaign ──
    const existingCampaignRecipientIds = new Set<string>();
    // ── Email-Address-Level Deduplication ──
    // Prevents duplicate sends when the same email appears under multiple accounts/contacts.
    // Pre-seeded from existing outreach items so it works across separate batch calls.
    const sentEmailsThisDispatch = new Set<string>();

    if (campaignId && !testMode) {
      try {
        const trackedItems = await prismadb.crm_Outreach_Items.findMany({
          where: { campaign: campaignId },
          select: { lead: true, account_id: true, candidate_email: true }
        });
        for (const item of trackedItems) {
          if (item.lead) existingCampaignRecipientIds.add(item.lead);
          if (item.account_id) existingCampaignRecipientIds.add(item.account_id);
          // Pre-seed email dedup from already-sent outreach items
          if ((item as any).candidate_email) {
            sentEmailsThisDispatch.add((item as any).candidate_email.toLowerCase());
          }
        }
        systemLogger.info(`[OUTREACH_SEND] Pre-loaded deduplication set for Campaign ${campaignId}: ${existingCampaignRecipientIds.size} entities, ${sentEmailsThisDispatch.size} unique emails.`);
      } catch (err: any) {
        systemLogger.error(`[OUTREACH_SEND] Failed to load campaign deduplication history: ${err.message}`);
      }
    }

    for (const recipient of recipients) {
      // ── Cancellation Checkpoint ──────────────────────────────────────────
      // Every 10 recipients, re-check campaign status to allow mid-send cancellation.
      // Only halt on PAUSED/ARCHIVED (intentional user action). NOT on COMPLETED —
      // the GET handler's auto-reconciliation can race against the send loop and
      // prematurely set COMPLETED, which would kill the send mid-batch.
      if (campaignId && recipientIndex > 0 && recipientIndex % 10 === 0) {
        try {
          const freshCampaign = await prismadb.crm_Outreach_Campaigns.findUnique({
            where: { id: campaignId },
            select: { status: true },
          });
          if (freshCampaign && (freshCampaign.status === "PAUSED" || freshCampaign.status === "ARCHIVED")) {
            systemLogger.info(`[OUTREACH_SEND] ⛔ Campaign ${campaignId} status is ${freshCampaign.status} — stopping send at ${recipientIndex}/${recipients.length}`);
            results.push({ leadId: "SYSTEM", status: "skipped", reason: `Campaign stopped (status: ${freshCampaign.status}). Processed ${recipientIndex}/${recipients.length} recipients.` });
            break;
          }
        } catch { /* non-fatal — continue sending */ }
      }
      recipientIndex++;

      const lead = recipient;
      const targetEmail = recipient.targetEmail;

      // ─── Absolute Backend Deduplication ──────────────────────────────────
      // Block 2: Reject if the Database confirms we already tracked an outreach item for this entity
      // in this specific Campaign. (The ultimate failsafe against UI payload bugs)
      if (campaignId && existingCampaignRecipientIds.has(lead.id)) {
        systemLogger.info(`[OUTREACH_SEND] Target ${targetEmail} skipped: Lead ${lead.id} already exists in Campaign ${campaignId}.`);
        results.push({ leadId: lead.id, status: "skipped", reason: `Deduplicated: Lead already tracked in campaign history.` });
        continue;
      }

      // Block 3: Email-address-level dedup — prevents sending to the same email
      // when both an Account and its linked Contact share the same address.
      if (!testMode && targetEmail && sentEmailsThisDispatch.has(targetEmail.toLowerCase())) {
        systemLogger.info(`[OUTREACH_SEND] Target ${targetEmail} skipped: Already sent to this email in current dispatch (Lead ${lead.id}).`);
        results.push({ leadId: lead.id, status: "skipped", reason: `Deduplicated: Email address already contacted in this batch.` });
        continue;
      }


      // Basic validation
      let toEmails: string[] = [targetEmail];
      
      // Check if any of the target emails are unsubscribed
      const unsubscribedTargetEmails = toEmails.filter(email => unsubSet.has(email.toLowerCase()));
      if (unsubscribedTargetEmails.length > 0) {
        results.push({ leadId: lead.id, status: "skipped", reason: `Unsubscribed contact(s): ${unsubscribedTargetEmails.join(', ')}` });
        continue;
      }

      // ── Live Email Verification ──────────────────────────────────────────
      if (!testMode && targetEmail) {
        try {
          const { verifyEmail } = await import("@/lib/scraper/verify/email-verify");
          const { buildResendAdapters } = await import("@/lib/scraper/verify/adapters/resend-adapters");
          systemLogger.info(`[OUTREACH_SEND] Verifying email liveliness for ${targetEmail}`);
          const verification = await verifyEmail(targetEmail, {
            stages: ["syntax", "mx", "smtp"],
            adapters: buildResendAdapters(),
          });
          
          if (verification.status === "invalid") {
            systemLogger.warn(`[OUTREACH_SEND] Target ${targetEmail} skipped: Email verification failed (Status: invalid). Reasons: ${verification.reasons.join(", ")}`);
            results.push({ leadId: lead.id, status: "skipped", reason: `Invalid email address: ${verification.reasons.join(", ")}` });
            continue;
          }
        } catch (verifErr: any) {
          systemLogger.warn(`[OUTREACH_SEND] Email verification threw an error for ${targetEmail}: ${verifErr.message}`);
        }
      }

      // Choose meeting link: override > lead's outreach_meeting_link > user's profile meeting link
      const meetingLink = meetingLinkOverride || lead.outreach_meeting_link || user.meeting_link || null;

      // Create or reuse tracking token (generate new on send)
      const token = (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || `${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      const trackingPixelUrl = baseUrl ? `${baseUrl}/api/outreach/open/${encodeURIComponent(token)}.png` : undefined;

      // Generate unsubscribe token (separate from tracking token)
      const unsubToken = (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) || `unsub_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const unsubscribeUrl = baseUrl && !testMode ? `${baseUrl}/api/outreach/unsubscribe/${encodeURIComponent(unsubToken)}` : undefined;

      // Build LLM prompt
      const contactName = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
      const basePrompt = promptOverride || user.outreach_prompt_default || null;

      systemLogger.info(`[OUTREACH_SEND] Lead data for AI prompt: id=${lead.id}, contactName="${contactName}", firstName="${lead.firstName}", lastName="${lead.lastName}", email=${lead.email}, company="${lead.company}"`);


      // Research the lead's company for personalization
      let companyResearch: string | null = null;
      if (lead.email) {
        try {
          companyResearch = await researchCompany(lead.email);
        } catch (researchErr: any) {
          systemLogger.warn(`[OUTREACH_SEND] Company research failed for ${lead.email}: ${researchErr?.message}`);
        }
      }

      // Determine sender identity (override or user profile)
      const senderName = body.senderOverride?.name || (user as any).name || session.user.name || "the sender";
      const senderTitle = body.senderOverride?.title || "";
      const senderCompany = brandIdentity?.company_name || "";

      // Detect sender-recipient overlap (same name, shared last name, or same company)
      // to inject disambiguation into the system instruction
      const senderLower = senderName.toLowerCase().trim();
      const contactLower = contactName.toLowerCase().trim();
      const recipientFirst = (lead.firstName || "").trim();
      const senderOverlap =
        senderLower === contactLower || // exact name match
        (lead.lastName && senderLower.includes(lead.lastName.toLowerCase())) || // shared last name
        (lead.company && senderCompany && lead.company.toLowerCase() === senderCompany.toLowerCase()); // same company

      const userPrompt = buildOutreachPrompt({
        basePrompt,
        contact: {
          name: contactName || undefined,
          company: lead.company || undefined,
          jobTitle: lead.jobTitle || undefined,
          email: lead.email || undefined,
        },
        sender: {
          name: senderName,
          title: senderTitle,
          company: senderCompany,
        },
        companyResearch,
        meetingLink,
        channel: "EMAIL",
        brandIdentity
      });

      // Use pre-generated content if provided (skips AI call - faster for test sends)
      let subject = preGeneratedSubject || "Exploring Partnership Opportunities";
      let bodyText = preGeneratedBody || "Hello,\n\nI'd like to explore how we could align with your investment thesis.\n\nThanks.";

      // Only call AI if no pre-generated content provided
      if (!preGeneratedSubject || !preGeneratedBody) {
        // Build system instruction, adding disambiguation when sender/recipient overlap
        let sysInstr = systemInstruction(senderName, senderTitle, recipientFirst || undefined);
        if (senderOverlap && recipientFirst) {
          sysInstr += ` IMPORTANT: The recipient's name is "${recipientFirst}" (${contactName}). Even if the sender and recipient share the same name or company, you MUST address the greeting to "${recipientFirst}" — do NOT use the sender's name in the greeting.`;
        }

        try {
          const { object, usage } = await generateObject({
            model,
            schema: z.object({
              subject: z.string(),
              body: z.string(),
            }),
            messages: [
              { role: "system", content: sysInstr },
              { role: "user", content: userPrompt },
            ],
          });

          subject = object.subject || subject;
          bodyText = object.body || bodyText;

          // Track AI token usage
          await logAiUsage({
            teamId, userId: session.user.id, service: "email",
            model: modelId || "unknown",
            usage: { 
                promptTokens: (usage as any)?.promptTokens || (usage as any)?.inputTokens || 0, 
                completionTokens: (usage as any)?.completionTokens || (usage as any)?.outputTokens || 0 
            },
            description: "Outreach email generation"
          });

        } catch (err: any) {
          // generateObject failed (model may output thinking tokens) — retry with generateText + manual JSON parse
          systemLogger.warn("[OUTREACH_SEND][AI_RETRY] generateObject failed, retrying with generateText:", err?.message);
          try {
            const { text: rawText, usage: retryUsage } = await generateText({
              model,
              system: sysInstr + " Return ONLY valid JSON, no markdown fences, no explanations.",
              prompt: userPrompt,
            });

            // Strip thinking tags and extract JSON
            let cleaned = rawText
              .replace(/<think>[\s\S]*?<\/think>/gi, "")
              .replace(/```json\s*/gi, "")
              .replace(/```\s*/gi, "")
              .trim();

            // Find JSON object in the response
            const jsonMatch = cleaned.match(/\{[\s\S]*"subject"[\s\S]*"body"[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              subject = parsed.subject || subject;
              bodyText = parsed.body || bodyText;
              systemLogger.info("[OUTREACH_SEND][AI_RETRY] Successfully parsed fallback response");
            } else {
              systemLogger.error("[OUTREACH_SEND][AI_RETRY] No JSON found in fallback response");
            }

            await logAiUsage({
              teamId, userId: session.user.id, service: "email",
              model: modelId || "unknown",
              usage: { 
                  promptTokens: (retryUsage as any)?.promptTokens || (retryUsage as any)?.inputTokens || 0, 
                  completionTokens: (retryUsage as any)?.completionTokens || (retryUsage as any)?.outputTokens || 0 
              },
              description: "Outreach email generation (retry)"
            });
          } catch (retryErr: any) {
            systemLogger.error("[OUTREACH_SEND][AI_ERROR] Both attempts failed:", retryErr?.message || retryErr);
          }
        }
      }

      const brandColorHex = (body.themeColorOverride || brandAccentColor).replace("#", "");
      // Resolve icon names to self-hosted SVG URLs
      const resolvedResources = resources.map((r: any) => {
        const iconName = r.icon || inferIconFromResource(r);
        const isPrimary = r.type === "primary";
        const colorParam = isPrimary ? "ffffff" : brandColorHex;
        return {
          ...r,
          iconUrl: resolveIconUrl(iconName, baseUrl, colorParam) || r.iconUrl,
          iconName,
        };
      });

      const brandProps = {
        accentColor: body.themeColorOverride || brandAccentColor,
        secondaryColor: body.secondaryColorOverride || undefined,
        primaryText: "#1f2937",
        logoUrl: brandLogoUrl,
        logoAlt: brandCompanyName || "Logo",
      };

      // Resolve bannerImageUrl to a presigned URL if it's a raw S3 URL
      let resolvedTemplateOptions = body.templateOptions || undefined;
      if (resolvedTemplateOptions?.bannerImageUrl) {
        const bannerUrl = resolvedTemplateOptions.bannerImageUrl;
        if (bannerUrl.includes(".s3.") || bannerUrl.includes("cloud.ovh.us")) {
          try {
            const { getBlobServiceClient } = await import("@/lib/s3-storage");
            const s3 = getBlobServiceClient();
            const bucketName = process.env.S3_BUCKET_NAME || "basaltcrm";
            const urlObj = new URL(bannerUrl);
            const pathParts = urlObj.pathname.split("/").filter(Boolean);
            const key = pathParts[0] === bucketName ? pathParts.slice(1).join("/") : pathParts.join("/");
            const signedUrl = await s3.getPresignedUrl(key, 604800); // 7 days
            resolvedTemplateOptions = { ...resolvedTemplateOptions, bannerImageUrl: signedUrl };
          } catch (e) { systemLogger.error("[OUTREACH_SEND] Failed to sign banner URL:", e); }
        }
      }

      let html: string;
      if (preGeneratedHtml) {
        html = preGeneratedHtml;
      } else if (body.templateId && body.templateId !== "minimal") {
        html = await renderOutreachTemplate(body.templateId, {
          subjectPreview: subject,
          bodyText,
          resources: resolvedResources,
          signatureHtml,
          trackingPixelUrl,
          brand: brandProps,
          templateOptions: resolvedTemplateOptions,
          unsubscribeUrl,
        });
      } else {
        html = await render(
          React.createElement(OutreachTemplate, {
            subjectPreview: subject,
            bodyText,
            resources: resolvedResources,
            signatureHtml,
            trackingPixelUrl,
            brand: brandProps,
            templateOptions: resolvedTemplateOptions,
            unsubscribeUrl,
          }),
        );
      }

      // Prepare plaintext fallback (use the LLM plain text body)
      const text = stripHtml(bodyText);
      // Send email via Team's custom mail service or personal email
      for (const toEmail of toEmails) {
        systemLogger.info(`[OUTREACH_SEND] Sending to=${toEmail}, subject="${subject.substring(0, 60)}", senderMode=${body.senderMode || "company"}, testMode=${testMode}, companyResearch=${companyResearch ? companyResearch.length + "chars" : "none"}`);
        try {
          if (!user.team_id) {
            throw new Error("No team associated with your account.");
          }

          let messageId: string | null = null;
          const senderMode = body.senderMode || "company";

          // Dynamically construct the Reply-To address to use the SES inbound subdomain.
          // e.g. john@basalthq.com -> john@reply.basalthq.com
          // Check for team's custom reply domain first, fall back to platform default
          let inboundDomain = process.env.SES_INBOUND_DOMAIN || "reply.basalthq.com";
          try {
            const teamReplyConfig = await prismadb.teamEmailConfig.findUnique({
              where: { team_id_purpose: { team_id: user.team_id!, purpose: "INBOUND" } },
              select: { reply_domain: true, reply_domain_status: true },
            });
            if (teamReplyConfig?.reply_domain && teamReplyConfig.reply_domain_status === "VERIFIED") {
              inboundDomain = teamReplyConfig.reply_domain;
            }
          } catch { /* use default */ }
          const userEmailPrefix = session.user.email?.split('@')?.[0] || "sales";
          const resolvedSenderName = senderName || session.user.name || "Outreach";
          const replyToAddress = `"${resolvedSenderName}" <${userEmailPrefix}@${inboundDomain}>`;

          // Track the actual sender email for inbound routing
          let actualSenderEmail = session.user.email || '';

          // ── Email Warm-Up Enforcement ──────────────────────────────────────
          // Resolve the sender email early so we can check warm-up quota
          let warmupSenderEmail = actualSenderEmail;
          if (senderMode !== "personal") {
            try {
              const teamOutboundCheck = await prismadb.teamEmailConfig.findUnique({
                where: { team_id_purpose: { team_id: user.team_id!, purpose: "OUTREACH" } },
                select: { smtp_user: true },
              });
              if (teamOutboundCheck?.smtp_user) warmupSenderEmail = teamOutboundCheck.smtp_user;
            } catch { /* use session email */ }
          }

          const warmupCheck = await checkWarmupQuota(user.team_id!, warmupSenderEmail);
          if (!warmupCheck.allowed) {
            systemLogger.info(`[OUTREACH_SEND] Warm-up limit reached for ${warmupSenderEmail}: ${warmupCheck.sentToday}/${warmupCheck.dailyLimit} (${warmupCheck.phase})`);
            results.push({ leadId: lead.id, status: "skipped", reason: warmupCheck.message || `Warm-up daily limit reached (${warmupCheck.sentToday}/${warmupCheck.dailyLimit}). ${warmupCheck.phase}, day ${warmupCheck.daysActive + 1}.` });
            continue;
          }

          if (senderMode === "personal") {
            // Personal mode: send via Amazon SES using the user's identity
            actualSenderEmail = session.user.email || process.env.SES_FROM_ADDRESS || 'noreply@basalthq.com';
            await sendSystemEmail({
              to: toEmail,
              subject,
              text,
              html,
              from: `"${resolvedSenderName}" <${actualSenderEmail}>`,
              replyTo: replyToAddress,
            }).then(id => { messageId = id || `ses_personal_${Date.now()}`; });
          } else {
            // Company mode: use team email config
            try {
              // Resolve the team's outbound email for tracking
              try {
                const teamOutbound = await prismadb.teamEmailConfig.findUnique({
                  where: { team_id_purpose: { team_id: user.team_id!, purpose: "OUTREACH" } },
                  select: { smtp_user: true },
                });
                if (teamOutbound?.smtp_user) actualSenderEmail = teamOutbound.smtp_user;
              } catch { /* keep session email */ }

              const teamMsgId = await sendTeamEmail(user.team_id, {
                to: toEmail,
                subject,
                text,
                html,
                senderId: session.user.id,
                replyTo: replyToAddress,
              }, "OUTREACH");
              messageId = teamMsgId || `team_sent_${Date.now()}`;
            } catch (teamErr: any) {
              systemLogger.warn(`[OUTREACH_SEND] Team email failed for ${actualSenderEmail}:`, teamErr?.message);
              // Gracefully handle email send failures without falling back to the system email
              throw new Error(`Your outbound email (${actualSenderEmail}) is not fully verified or configured. Please go to Settings > Email and complete the domain verification process before sending outreach.`);
            }
          }

          // ─── Pipeline provisioning for pool candidates ─────────────────
          // Flawed regex originally passed Candidates because they are 24-hex MongoDB IDs. 
          // We now rigorously verify using the actual database sets computed above.
          const isRealLead = foundDbIds.has(lead.id) || foundAccountIds.has(lead.id);
          let pipelineResult: any = null;

          if (!isRealLead && !testMode) {
            // Pool candidate: create Lead → Account → Contact
            if (!ensuredPipelineIds.has(lead.id)) {
                pipelineResult = await ensureLeadAndAccountForCandidate(
                  {
                    email: lead.email, // Use primary email to construct the pipeline entity
                    firstName: lead.firstName,
                    lastName: lead.lastName,
                    company: lead.company,
                    jobTitle: lead.jobTitle,
                  },
                  session.user.id,
                  user.team_id!,
                  body.campaignId,
                  body.poolId
                );
                ensuredPipelineIds.set(lead.id, pipelineResult);
            } else {
                pipelineResult = ensuredPipelineIds.get(lead.id);
            }

            // Register the newly created pipeline lead ID in the entity dedup set
            // so subsequent chunks (separate API calls) won't double-send.
            if (pipelineResult?.leadId) {
              existingCampaignRecipientIds.add(pipelineResult.leadId);
            }
            // Also register the raw candidate ID so the entity-level check (line 445)
            // catches it when the same candidate appears in a later chunk.
            existingCampaignRecipientIds.add(lead.id);

            // Create outreach item linked to campaign
            if (body.campaignId && pipelineResult) {
              await prismadb.crm_Outreach_Items.create({
                data: {
                  campaign: body.campaignId,
                  lead: pipelineResult.leadId,
                  channel: "EMAIL",
                  status: "SENT",
                  subject,
                  body_text: bodyText,
                  body_html: html,
                  message_id: messageId || undefined,
                  tracking_token: token,
                  unsubscribe_token: unsubToken,
                  sentAt: new Date(),
                  candidate_email: targetEmail,
                  candidate_name: contactName,
                  candidate_company: lead.company || undefined,
                  candidate_job_title: lead.jobTitle || undefined,
                  account_id: pipelineResult.accountId,
                  contact_id: pipelineResult.contactId,
                  sender_email: actualSenderEmail,
                },
              });

              // Increment campaign stats
              await prismadb.crm_Outreach_Campaigns.update({
                where: { id: body.campaignId },
                data: { emails_sent: { increment: 1 } },
              }).catch(() => { });
            }
          }

          // ─── Persist outreach fields for existing leads / accounts ────────────────
          const isDbLead = foundDbIds.has(lead.id);
          if (isDbLead) {
            // Lead exists in crm_Leads — update outreach tracking fields
            try {
              const updateData: any = {
                outreach_status: "SENT" as any,
                outreach_sent_at: new Date() as any,
                outreach_first_message_id: messageId || undefined,
                outreach_open_token: token,
                pipeline_stage: "Engage_AI" as any,
                outreach_transport: (senderMode === "personal" ? "personal" : "team_email") as any,
              };

              if (meetingLink && (!lead.outreach_meeting_link || meetingLinkOverride)) {
                updateData.outreach_meeting_link = meetingLink;
              }

              await prismadb.crm_Leads.update({
                where: { id: lead.id },
                data: updateData,
              });
              await ensureContactForLead(lead.id).catch(() => { });

              // Insert activity
              await prismadb.crm_Lead_Activities.create({
                data: {
                  lead: lead.id,
                  user: session.user.id,
                  type: "email_sent",
                  metadata: {
                    to: toEmail,
                    subject,
                    bodyText,
                    meetingLink,
                    messageId,
                    usedPrompt: (promptOverride && "batchOverride") || (user.outreach_prompt_default ? "userDefault" : "fallback"),
                    pipeline_stage: "Engage_AI",
                  } as any,
                },
              });
            } catch (actErr: any) {
              systemLogger.warn(`[OUTREACH_SEND] Failed to save lead activity: ${actErr?.message}`);
            }
          }

          // Save outreach status to CRM (Fire and forget DB update)
          // GUARD: Only run for real leads/accounts. Pool candidates already had
          // their outreach item created in the candidate-specific block above.
          // Running this for candidates caused a duplicate outreach item via the
          // account fallback path (lead.update fails → isLeadUpdated=false → account fallback).
          if (!testMode && isRealLead) {
            let isLeadUpdated = false;
            try {
              // Try to update crm_Leads for proper tracking
              await prismadb.crm_Leads.update({
                where: { id: lead.id },
                data: {
                  outreach_status: "SENT",
                  outreach_sent_at: new Date(),
                },
              });
              isLeadUpdated = true;

              // Create outreach item for campaign contact tracking
              if (campaignId) {
                try {
                  await prismadb.crm_Outreach_Items.create({
                    data: {
                      campaign: campaignId,
                      lead: lead.id,
                      channel: "EMAIL",
                      status: "SENT",
                      subject: subject || null,
                      body_text: bodyText || null,
                      message_id: messageId || null,
                      tracking_token: token,
                      unsubscribe_token: unsubToken,
                      sentAt: new Date(),
                      candidate_email: toEmail,
                      candidate_name: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null,
                      candidate_company: lead.company || null,
                      candidate_job_title: lead.jobTitle || null,
                      sender_email: actualSenderEmail,
                    } as any,
                  });
                } catch (itemErr: any) {
                  systemLogger.warn(`[OUTREACH_SEND] Failed to create outreach item for lead ${lead.id}: ${itemErr?.message}`);
                }
              }
            } catch (updateErr: any) {
              systemLogger.warn(`[OUTREACH_SEND] Post-send update failed for lead ${lead.id}: ${updateErr?.message || "record not found"}`);
            }

            // Fallback: If it's an Account (not a Lead), tag the account and track the outreach item
            if (!isLeadUpdated) {
              try {
                await prismadb.crm_Accounts.update({
                  where: { id: lead.id },
                  data: { status: "Contacted" },
                }).catch(() => { /* ID might not be an account either — that's OK */ });

                // Create outreach item for campaign tracking (account-based)
                if (campaignId) {
                  await prismadb.crm_Outreach_Items.create({
                    data: {
                      campaign: campaignId,
                      channel: "EMAIL",
                      status: "SENT",
                      subject: subject || null,
                      body_text: bodyText || null,
                      message_id: messageId || null,
                      tracking_token: token,
                      unsubscribe_token: unsubToken,
                      sentAt: new Date(),
                      candidate_email: toEmail,
                      candidate_name: lead.company || lead.firstName || null,
                      candidate_company: lead.company || null,
                      candidate_job_title: lead.jobTitle || null,
                      account_id: lead.id,
                      sender_email: actualSenderEmail,
                    } as any,
                  }).catch((e: any) => systemLogger.warn(`[OUTREACH_SEND] Failed to create outreach item for account ${lead.id}: ${e?.message}`));
                }
              } catch (acctErr: any) {
                systemLogger.warn(`[OUTREACH_SEND] Post-send account update failed for ${lead.id}: ${acctErr?.message}`);
              }
            }
          }

          // Track this email in the dispatch-level dedup set
          if (targetEmail) sentEmailsThisDispatch.add(targetEmail.toLowerCase());

          // ── Record Warm-Up Send ──────────────────────────────────────────
          await recordWarmupSend(user.team_id!, actualSenderEmail).catch((e: any) =>
            systemLogger.warn(`[OUTREACH_SEND] Failed to record warm-up send: ${e?.message}`)
          );

          results.push({ leadId: lead.id, status: "sent", subject, to: toEmail });
        } catch (err: any) {

          systemLogger.error("[OUTREACH_SEND][SMTP_ERROR]", err?.message || err);
          results.push({ leadId: lead.id, status: "error", reason: err?.message || "Send failed" });
        }
      } // end toEmails loop
    }

    // ── Warm-up status for response ──
    let warmupInfo: { phase: string; dailyLimit: number; sentToday: number; daysActive: number } | undefined;
    try {
      // Resolve the sender email for the warmup status check
      let statusSenderEmail = session.user.email || '';
      const statusSenderMode = body.senderMode || "company";
      if (statusSenderMode !== "personal" && user.team_id) {
        const teamOutbound = await prismadb.teamEmailConfig.findUnique({
          where: { team_id_purpose: { team_id: user.team_id, purpose: "OUTREACH" } },
          select: { smtp_user: true },
        }).catch(() => null);
        if (teamOutbound?.smtp_user) statusSenderEmail = teamOutbound.smtp_user;
      }
      const finalWarmup = await checkWarmupQuota(user.team_id!, statusSenderEmail);
      if (finalWarmup.dailyLimit !== -1) {
        warmupInfo = {
          phase: finalWarmup.phase,
          dailyLimit: finalWarmup.dailyLimit,
          sentToday: finalWarmup.sentToday,
          daysActive: finalWarmup.daysActive,
        };
      }
    } catch { /* non-fatal */ }

    const summary = {
      requested: body.leadIds.length,
      processed: leads.length,
      sent: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
      results,
      warmup: warmupInfo,
    };

    // Update campaign emails_sent counter — use actual count for accuracy (idempotent)
    if (campaignId && summary.sent > 0 && !testMode) {
      try {
        const { prismadbCrm } = await import("@/lib/prisma-crm");
        // Count all SENT outreach items for this campaign — always accurate
        const sentCount = await (prismadbCrm as any).crm_Outreach_Items.count({
          where: { campaign: campaignId, status: "SENT" },
        });
        await (prismadbCrm as any).crm_Outreach_Campaigns.update({
          where: { id: campaignId },
          data: { emails_sent: sentCount },
        });
      } catch (e: any) {
        systemLogger.warn(`[OUTREACH_SEND] Failed to update campaign emails_sent: ${e?.message}`);
      }
    }

    // Gamification: award bonus credits for first outreach email (fire-and-forget)
    if (summary.sent > 0 && !testMode) {
      claimOnboardingBonus("first_outreach_email").catch(() => { });

      // Gamification hook: Phase 2 Level 8 Tracking
      import("@/actions/university/log-user-metric")
        .then((m) => m.logUserMetric("sent_crm_email").catch(() => {}));

      // Gamification hook: Raw XP awarded per email sent
      import("@/actions/quests/add-raw-xp")
        .then((m) => m.addRawXP({ userId: session.user.id, xpAmount: summary.sent, reason: "Outreach Emails Sent" }))
        .catch((e) => systemLogger.warn(`[OUTREACH_SEND] Failed to award XP: ${e?.message}`));
    }

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {

    systemLogger.error("[OUTREACH_SEND_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
