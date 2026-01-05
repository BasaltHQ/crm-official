import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import sendEmail from "@/lib/sendmail";
import { render } from "@react-email/render";
import OutreachTemplate, { type ResourceLink } from "@/emails/OutreachTemplate";
import { getAiSdkModel } from "@/lib/openai";
import { generateObject } from "ai";
import { z } from "zod";
import React from "react";

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
  meetingLinkOverride?: string;
  test?: boolean;
};

const DEFAULT_TEST_EMAIL = "founders@theutilitycompany.co";

const DEFAULT_RESOURCES: ResourceLink[] = [
  { id: "portalpay", label: "Explore PortalPay", href: "https://pay.ledger1.ai", type: "primary", enabled: true },
  { id: "calendar", label: "Schedule a Call", href: "https://calendar.app.google/EJ4WsqeS2JSXt6ZcA", type: "primary", enabled: true },
  { id: "investor_portal", label: "View Investor Portal", href: "https://stack.angellist.com/s/lp1srl5cnf", type: "secondary", enabled: true },
  { id: "data_room", label: "Access Data Room", href: "https://stack.angellist.com/s/x8g9yjgpbw", type: "secondary", enabled: true },
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

function buildFollowupPrompt(params: {
  basePrompt: string | null | undefined;
  contact: { name?: string | null; company?: string | null; jobTitle?: string | null; email?: string | null };
  lastSentAt?: Date | null;
  meetingLink?: string | null;
}) {
  const { basePrompt, contact, lastSentAt, meetingLink } = params;

  const fallbackBase = `
Write a concise follow-up email about PortalPay. Assume we sent an initial note recently.
Keep tone respectful and value-focused. Offer a meeting with a clear CTA.
Avoid headings; ensure plain text JSON output with keys "subject" and "body".
`.trim();

  const promptBase = (basePrompt && basePrompt.trim().length > 0 ? basePrompt : fallbackBase).trim();

  const lastSent = lastSentAt ? new Date(lastSentAt).toLocaleDateString() : "recently";

  return [
    promptBase,
    `Contact:
- Name: ${contact?.name || ""}
- Company/Firm: ${contact?.company || ""}
- Title: ${contact?.jobTitle || ""}
- Email: ${contact?.email || ""}`,
    `We previously reached out: ${lastSent}`,
    `Meeting preference/link (for CTA): ${meetingLink || "N/A"}`,
  ].join("\n\n");
}

type Params = { params: Promise<{ leadId: string }> };
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { leadId } = await params;
    if (!leadId) {
      return new NextResponse("Missing leadId", { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;

    // Load user settings
    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        is_admin: true,
        is_account_admin: true,
        meeting_link: true,
        signature_html: true,
        resource_links: true,
        outreach_prompt_default: true,
      } as const,
    });
    if (!user) return new NextResponse("User not found", { status: 404 });

    // Load lead and check eligibility
    const lead = await prismadb.crm_Leads.findUnique({
      where: { id: leadId },
      select: {
        id: true,
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

    const eligibleStatus = lead.outreach_status === ("SENT" as any) || lead.outreach_status === ("OPENED" as any);
    const noBooking = !lead.outreach_meeting_booked_at;
    if (!eligibleStatus || !noBooking) {
      return new NextResponse("Lead not eligible for follow-up", { status: 400 });
    }

    const toEmail = body.test ? (process.env.TEST_EMAIL || DEFAULT_TEST_EMAIL) : (lead.email || "");
    if (!toEmail) return new NextResponse("Lead has no email", { status: 400 });

    // Unsubscribe check (best effort)
    const contact = await prismadb.crm_Contacts.findFirst({
      where: { email: lead.email || "" },
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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const token =
      (globalThis.crypto?.randomUUID && globalThis.crypto.randomUUID()) ||
      `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const trackingPixelUrl = baseUrl ? `${baseUrl}/api/outreach/open/${encodeURIComponent(token)}.png` : undefined;

    // OpenAI client
    const model = await getAiSdkModel(session.user.id);
    if (!model) return new NextResponse("AI model not configured", { status: 500 });

    const contactName = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
    const promptOverride = body.promptOverride?.trim();
    const userPrompt = buildFollowupPrompt({
      basePrompt: promptOverride || user.outreach_prompt_default || null,
      contact: { name: contactName || undefined, company: lead.company || undefined, jobTitle: lead.jobTitle || undefined, email: lead.email || undefined },
      lastSentAt: lead.outreach_sent_at || null,
      meetingLink,
    });

    // Generate follow-up content
    let subject = "Quick follow-up on PortalPay";
    let bodyText = "Hello,\n\nJust following up on my previous note about PortalPay...\n\nThanks.";
    try {
      const { object } = await generateObject({
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
    } catch (err: any) {
       
      console.error("[FOLLOWUP][AI_ERROR]", err?.message || err);
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
    await sendEmail({
      from: fromAddress,
      to: toEmail,
      subject,
      text,
      html,
    });

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
        user: session.user.id,
        type: "followup_sent",
        metadata: { to: toEmail, subject } as any,
      },
    });

    return NextResponse.json({ status: "ok", leadId: lead.id, to: toEmail, subject }, { status: 200 });
  } catch (error) {
     
    console.error("[OUTREACH_FOLLOWUP_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
