import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/voice/engage/webhook
 * VoiceHub → Ledger1CRM webhook for agent/call events with optional HMAC verification and best-effort idempotency.
 *
 * Security:
 * - Set VOICEHUB_WEBHOOK_SECRET to enable HMAC verification (Header: x-voicehub-signature = hex(HMAC_SHA256(rawBody, secret)))
 *
 * Event payload examples:
 * {
 *   "type": "tool_call",
 *   "name": "schedule_meeting",
 *   "leadId": "lead_abc",
 *   "args": { "datetime": "2025-11-21T15:00:00Z", "timezone": "America/Denver" },
 *   "eventId": "evt_123",
 *   "ts": 1732040000000
 * }
 *
 * {
 *   "type": "call_connected",
 *   "leadId": "lead_abc",
 *   "eventId": "evt_456",
 *   "ts": 1732030000000
 * }
 *
 * {
 *   "type": "call_ended",
 *   "leadId": "lead_abc",
 *   "durationSec": 482,
 *   "eventId": "evt_789",
 *   "ts": 1732030482000
 * }
 */

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function verifySignature(raw: string, signatureHex: string | null): Promise<boolean> {
  const secret = process.env.VOICEHUB_WEBHOOK_SECRET;
  if (!secret) return true; // allow if no secret configured
  if (!signatureHex) return false;
  // Compute HMAC-SHA256 of raw body
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
  const signedBytes = new Uint8Array(sig);
  // Convert provided hex signature to bytes
  const providedBytes = new Uint8Array(signatureHex.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) || []);
  return timingSafeEqual(signedBytes, providedBytes);
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
    } catch {}
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const signature = req.headers.get("x-voicehub-signature");
    const ok = await verifySignature(raw, signature);
    if (!ok) {
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
      } catch {}
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
          body: JSON.stringify({ datetime: args?.datetime, timezone: args?.timezone, source: "voicehub_tool" }),
        });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));
          createdLink = String(j?.meetingLink || j?.link || "") || null;
        }
      } catch {}

      // Advance pipeline stage to Engage_Human and update meeting link if provided
      try {
        await prismadb.crm_Leads.update({
          where: { id: leadId },
          data: {
            pipeline_stage: "Engage_Human" as any,
            outreach_meeting_link: createdLink || undefined,
          } as any,
        });
      } catch {}

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
      } catch {}
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
      } catch {}
      await logActivity("call_ended", { ts: body?.ts, durationSec });

      // Optional: trigger follow-up scheduling (deferred execution recommended)
      // Here we simply log an intent; a cron can process leads with call_status=ENDED and dispatch follow-ups.
      await logActivity("followup_intent", { reason: "post-call", suggestedDelayDays: 2 });

      return NextResponse.json({ ok: true, action: "call_ended" }, { status: 200 });
    }

    // Unknown type: log and return
    await logActivity("voicehub_event", { body });
    return NextResponse.json({ ok: true, action: "logged" }, { status: 200 });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[VOICE_ENGAGE_WEBHOOK]", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
