import { NextResponse } from "next/server";
import crypto from "crypto";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import sendEmail from "@/lib/sendmail";
import { render } from "@react-email/render";
import OutreachTemplate, { type ResourceLink } from "@/emails/OutreachTemplate";
import { getAiSdkModel, logAiUsage } from "@/lib/varuni";
import { generateObject } from "ai";
import { z } from "zod";
import React from "react";
import { systemLogger } from "@/lib/logger";
import { checkWarmupQuota, recordWarmupSend } from "@/lib/email-warmup";

/**
 * POST /api/outreach/followup/[leadId]
 * Optional Body: { promptOverride?: string, meetingLinkOverride?: string, test?: boolean }
 * Sends a follow-up outreach email if lead is in a follow-up-eligible state:
 * - Eligible if outreach_status is SENT or OPENED and no outreach_meeting_booked_at.
 * - Generates a shorter, polite follow-up email referencing previous send.
 * - Uses user signature/resources, tracking pixel, and meeting link as in initial send.
 * - Updates outreach_followup_sent_at and inserts crm_Lead_Activities(type="followup_sent").
 */

type RequestBody = {
  promptOverride?: string;
  customPrompt?: string;
  campaignId?: string;
  followupNumber?: number;
  meetingLinkOverride?: string;
  test?: boolean;
};


const DEFAULT_RESOURCES: ResourceLink[] = [
  { id: "website", label: "Visit Website", href: "#", type: "primary", enabled: true },
  { id: "calendar", label: "Schedule a Call", href: "#", type: "primary", enabled: true },
  { id: "linkedin", label: "Follow on LinkedIn", href: "#", type: "secondary", enabled: true }
];

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}

function systemInstructionFollowup() {
  return [
    "You are a professional BD specialist writing a follow-up outreach email.",
    "Return ONLY JSON with keys 'subject' and 'body'.",
    "The 'body' must be plain text (no HTML), ~120–180 words, first person, respectful, concise.",
    "Reference that you reached out previously and add a gentle CTA to schedule.",
    "Do not include headings or phrases like 'Founder note'.",
  ].join(" ");
}

import { buildOutreachPrompt } from "@/lib/outreach/prompt-builder";

function isValidCronCall(req: Request): boolean {
  const expected = process.env.CRON_SECRET || "";
  const provided = req.headers.get("x-cron-secret")?.trim() || "";
  if (!expected || !provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type Params = { params: Promise<{ leadId: string }> };
export async function POST(req: Request, { params }: Params) {
  try {
    const { leadId } = await params;
    if (!leadId) {
      return new NextResponse("Missing leadId", { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const isCron = isValidCronCall(req);

    // Load lead first so we can verify tenant ownership
    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        team_id: true,
        firstName: true,
        lastName: true,
        company: true,
        jobTitle: true,
        email: true,
        outreach_status: true,
        outreach_sent_at: true,
        outreach_meeting_booked_at: true,
        outreach_meeting_link: true,
        assigned_to: true,
      },
    });
    if (!lead) return new NextResponse("Lead not found", { status: 404 });

    let actingUserId: string | null = null;
    let actingUserEmail: string | null = null;

    if (isCron) {
      if (!body.campaignId) {
        return new NextResponse("Missing campaignId for cron followup", { status: 400 });
      }
      const campaign = await prismadb.crm_Outreach_Campaigns.findUnique({
        where: { id: body.campaignId },
        select: { id: true, user: true, team_id: true },
      });
      if (!campaign || !campaign.team_id || campaign.team_id !== lead.team_id) {
        return new NextResponse("Forbidden — campaign/lead team mismatch", { status: 403 });
      }
      actingUserId = campaign.user || lead.assigned_to || null;
      if (!actingUserId) {
        return new NextResponse("No campaign owner found", { status: 400 });
      }
    } else {
      const { error, session, teamInfo } = await getSessionAndTeam();
      if (error) return error;
      if (!validateResourceOwnership(teamInfo!.teamId, lead.team_id, teamInfo!.isPlatformAdmin)) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      if (!teamInfo!.isAdmin && lead.assigned_to && lead.assigned_to !== session!.user.id) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      actingUserId = session!.user.id;
      actingUserEmail = session!.user.email || null;
    }

    // Load user settings
    const user = await prismadb.users.findUnique({
      where: { id: actingUserId },
      select: {
        id: true,
        email: true,
        is_admin: true,
        is_account_admin: true,
        meeting_link: true,
        signature_html: true,
        resource_links: true,
        outreach_prompt_default: true,
        team_id: true,
      } as const,
    });
    if (!user) return new NextResponse("User not found", { status: 404 });

    let brandIdentity = null;
    const effectiveTeamId = lead.team_id || user.team_id;
    if (effectiveTeamId) {
        brandIdentity = await prismadb.teamBrandIdentity.findFirst({
            where: { team_id: effectiveTeamId, is_default: true }
        });
    }

    const eligibleStatus = lead.outreach_status === ("SENT" as any) || lead.outreach_status === ("OPENED" as any);
    const noBooking = !lead.outreach_meeting_booked_at;
    if (!eligibleStatus || !noBooking) {
      return new NextResponse("Lead not eligible for follow-up", { status: 400 });
    }

    const toEmail = body.test ? (process.env.TEST_EMAIL || actingUserEmail || user.email || "") : (lead.email || "");
    if (!toEmail) return new NextResponse("Lead has no email", { status: 400 });

    // Unsubscribe check (best effort, scoped to tenant if present)
    const contact = await prismadb.crm_Contacts.findFirst({
      where: {
        email: lead.email || "",
        ...(lead.team_id ? { team_id: lead.team_id } : {}),
      },
      select: { email_unsubscribed: true },
    });
    if (contact?.email_unsubscribed) {
      return new NextResponse("Contact unsubscribed", { status: 400 });
    }

    // Resources/signature
    let resources: ResourceLink[] = DEFAULT_RESOURCES;
    try {
      if (user.resource_links && typeof user.resource_links === "object") {
        resources = (user.resource_links as any) as ResourceLink[];
        if (!Array.isArray(resources)) resources = DEFAULT_RESOURCES;
      }
    } catch {
      resources = DEFAULT_RESOURCES;
    }
    const signatureHtml = user.signature_html || undefined;

    // Meeting link resolution
    const meetingLinkOverride = body.meetingLinkOverride?.trim();
    let meetingLink = meetingLinkOverride || lead.outreach_meeting_link || user.meeting_link || null;

    // Tracking pixel token (new token for follow-up send)
    const rawBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const baseUrl = rawBaseUrl.includes("localhost") ? "https://crm.basalthq.com" : rawBaseUrl;
    const token =
      (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
      `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const trackingPixelUrl = baseUrl ? `${baseUrl}/api/outreach/open/${encodeURIComponent(token)}.png` : undefined;

    // OpenAI client
    const { model, modelId, teamId } = await getAiSdkModel(actingUserId);
    if (!model) return new NextResponse("AI model not configured", { status: 500 });

    const contactName = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
    const promptOverride = (body.promptOverride || body.customPrompt)?.trim();
    const basePrompt = buildOutreachPrompt({
      basePrompt: promptOverride || user.outreach_prompt_default || null,
      contact: { name: contactName || undefined, company: lead.company || undefined, jobTitle: lead.jobTitle || undefined, email: lead.email || undefined },
      meetingLink,
      companyResearch: null,
      channel: "FOLLOWUP",
      brandIdentity
    });

    const lastSent = lead.outreach_sent_at ? new Date(lead.outreach_sent_at).toLocaleDateString() : "recently";
    const userPrompt = basePrompt + `\n\nWe previously reached out: ${lastSent}`;

    // Generate follow-up content
    let subject = "Quick follow-up";
    let bodyText = "Hello,\n\nJust following up on my previous note...\n\nThanks.";
    try {
      const { object, usage } = await generateObject({
        model,
        schema: z.object({
          subject: z.string(),
          body: z.string(),
        }),
        messages: [
          { role: "system", content: systemInstructionFollowup() },
          { role: "user", content: userPrompt },
        ],
      });
      subject = object.subject || subject;
      bodyText = object.body || bodyText;

      // Track AI token usage
      await logAiUsage({
        teamId: teamId || effectiveTeamId || null, userId: actingUserId, service: "email",
        model: modelId || "unknown",
        usage: { promptTokens: (usage as any)?.promptTokens || 0, completionTokens: (usage as any)?.completionTokens || 0 },
        description: "Outreach followup email"
      });
    } catch (err: any) {

      systemLogger.error("[FOLLOWUP][AI_ERROR]", err?.message || err);
    }

    // Render HTML
    const html = await render(
      React.createElement(OutreachTemplate, {
        subjectPreview: subject,
        bodyText,
        resources,
        signatureHtml,
        trackingPixelUrl,
        brand: { accentColor: "#F54029", primaryText: "#1f2937" },
      }),
    );
    const text = stripHtml(bodyText);

    // Send email
    const fromAddress =
      process.env.EMAIL_FROM ||
      process.env.EMAIL_USERNAME ||
      `no-reply@${new URL(baseUrl || "http://localhost").hostname}`;

    // ── Email Warm-Up Enforcement ──
    if (user.team_id) {
      const warmupCheck = await checkWarmupQuota(user.team_id, fromAddress);
      if (!warmupCheck.allowed) {
        return NextResponse.json(
          { error: warmupCheck.message || `Warm-up daily limit reached (${warmupCheck.sentToday}/${warmupCheck.dailyLimit}).`, warmup: warmupCheck },
          { status: 429 }
        );
      }
    }

    await sendEmail({
      from: fromAddress,
      to: toEmail,
      subject,
      text,
      html,
    });

    // ── Record Warm-Up Send ──
    if (user.team_id) {
      await recordWarmupSend(user.team_id, fromAddress).catch((e: any) =>
        systemLogger.warn(`[FOLLOWUP] Failed to record warm-up send: ${e?.message}`)
      );
    }

    // Update lead and log activity
    await prismadb.crm_Leads.update({
      where: { id: lead.id },
      data: {
        outreach_followup_sent_at: new Date() as any,
        outreach_open_token: token,
        outreach_meeting_link: meetingLink || undefined,
      },
    });

    await prismadb.crm_Lead_Activities.create({
      data: {
        lead: lead.id,
        user: actingUserId,
        type: "followup_sent",
        metadata: { to: toEmail, subject } as any,
      },
    });

    return NextResponse.json({ status: "ok", leadId: lead.id, to: toEmail, subject }, { status: 200 });
  } catch (error) {

    systemLogger.error("[OUTREACH_FOLLOWUP_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
