import { NextRequest, NextResponse } from "next/server";
import nodeCrypto from "crypto";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

function verifySignature(raw: string, signatureHex: string | null, secret: string): boolean {
  if (!signatureHex || !secret) return false;
  const cleaned = signatureHex.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(cleaned)) return false;

  const expected = nodeCrypto.createHmac("sha256", secret).update(raw, "utf8").digest();
  const provided = Buffer.from(cleaned, "hex");
  return expected.length === provided.length && nodeCrypto.timingSafeEqual(expected, provided);
}

// Best-effort idempotency: check recent activities for matching eventId
async function isDuplicateEvent(leadId: string, eventId?: string | null): Promise<boolean> {
  if (!eventId) return false;
  // Fetch last 50 activities for the lead and check metadata.eventId
  const recent = await prismadb.crm_Lead_Activities.findMany({
    where: { lead: leadId },
    orderBy: { createdAt: "desc" } as any,
    take: 50,
  } as any);
  for (const a of recent) {
    try {
      const md = (a as any)?.metadata;
      if (md && typeof md === "object" && md.eventId && String(md.eventId) === String(eventId)) {
        return true;
      }
    } catch { }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const secret =
      process.env.BASALTECHO_WEBHOOK_SECRET ||
      process.env.VOICE_WEBHOOK_SECRET ||
      process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (!secret) {
      systemLogger.error("[VOICE_ENGAGE_WEBHOOK] Missing BASALTECHO_WEBHOOK_SECRET / VOICE_WEBHOOK_SECRET");
      return NextResponse.json({ ok: false, error: "Server misconfiguration" }, { status: 500 });
    }

    const raw = await req.text();
    const signature = req.headers.get("x-basaltecho-signature") || req.headers.get("x-webhook-signature");
    if (!verifySignature(raw, signature, secret)) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    let body: any = {};
    try {
      body = JSON.parse(raw);
    } catch {
      return new NextResponse("Invalid JSON", { status: 400 });
    }

    const type = String(body?.type || "");
    const leadId = String(body?.leadId || "");
    const eventId = body?.eventId ? String(body.eventId) : undefined;

    if (!type || !leadId) {
      return new NextResponse("Missing type or leadId", { status: 400 });
    }

    // Idempotency guard
    if (await isDuplicateEvent(leadId, eventId)) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    // Common activity logging helper (use const to avoid function declaration inside block for ES5 target)
    const logActivity = async (activityType: string, metadata: Record<string, any> = {}) => {
      try {
        await prismadb.crm_Lead_Activities.create({
          data: {
            lead: leadId,
            type: activityType,
            metadata: { ...metadata, eventId } as any,
          } as any,
        });
      } catch { }
    };

    // Route by event type
    if (type === "tool_call" && String(body?.name || "") === "schedule_meeting") {
      const args = (body?.args || {}) as { datetime?: string; timezone?: string };
      // Attempt to create meeting via internal endpoint
      let createdLink: string | null = null;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/outreach/meeting/${encodeURIComponent(leadId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ datetime: args?.datetime, timezone: args?.timezone, source: "basaltecho_tool" }),
        });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          createdLink = String(j?.meetingLink || j?.link || "") || null;
        }
      } catch { }

      // Advance pipeline stage to Engage_Human and update meeting link if provided
      try {
        await prismadb.crm_Leads.update({
          where: { id: leadId },
          data: {
            pipeline_stage: "Engage_Human" as any,
            outreach_meeting_link: createdLink || undefined,
          } as any,
        });
      } catch { }

      await logActivity("agent_schedule_meeting", {
        requested: args,
        meetingLink: createdLink,
      });

      return NextResponse.json({ ok: true, action: "schedule_meeting", meetingLink: createdLink }, { status: 200 });
    }

    if (type === "call_connected") {
      // Update call status and log
      try {
        await prismadb.crm_Leads.update({
          where: { id: leadId },
          data: {
            call_status: "CONNECTED",
          } as any,
        });
      } catch { }
      await logActivity("call_connected", { ts: body?.ts });

      return NextResponse.json({ ok: true, action: "call_connected" }, { status: 200 });
    }

    if (type === "call_ended") {
      const durationSec = typeof body?.durationSec === "number" ? body.durationSec : undefined;

      // Update call status and log
      try {
        await prismadb.crm_Leads.update({
          where: { id: leadId },
          data: {
            call_status: "ENDED",
          } as any,
        });
      } catch { }
      await logActivity("call_ended", { ts: body?.ts, durationSec });

      // Optional: trigger follow-up scheduling (deferred execution recommended)
      // Here we simply log an intent; a cron can process leads with call_status=ENDED and dispatch follow-ups.
      await logActivity("followup_intent", { reason: "post-call", suggestedDelayDays: 2 });

      return NextResponse.json({ ok: true, action: "call_ended" }, { status: 200 });
    }

    // Unknown type: log and return
    await logActivity("basaltecho_event", { body });
    return NextResponse.json({ ok: true, action: "logged" }, { status: 200 });
  } catch (e: any) {

    systemLogger.error("[VOICE_ENGAGE_WEBHOOK]", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
