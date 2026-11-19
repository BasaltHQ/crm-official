import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { getSessionAndTeam } from "@/lib/api-utils";
import { getTwilioConfig, twilioApiUrl, twilioAuthHeader } from "@/lib/twilio/twilio-voice";
import { systemLogger } from "@/lib/logger";

function verifyWebhookSecret(req: Request): boolean {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET || process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) return false;
  const provided =
    req.headers.get("x-webhook-secret")?.trim() ||
    req.headers.get("x-elevenlabs-secret")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  if (!provided) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/voice/elevenlabs/call-status?callSid=xxx
 * Polls Twilio for the call status using the authenticated tenant's Twilio credentials
 * (or verified webhook secret).
 */
export async function GET(req: Request) {
  const isWebhookAuth = verifyWebhookSecret(req);
  let teamId: string | null = null;
  let isPlatformAdmin = false;

  if (!isWebhookAuth) {
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;
    teamId = teamInfo?.teamId || null;
    isPlatformAdmin = Boolean(teamInfo?.isPlatformAdmin);
    if (!teamId && !isPlatformAdmin) {
      return NextResponse.json({ error: "No team context" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const callSid = searchParams.get("callSid")?.trim() || "";

  if (!/^CA[0-9a-fA-F]{32}$/.test(callSid)) {
    return NextResponse.json({ error: "Invalid or missing callSid" }, { status: 400 });
  }

  try {
    let accountSid = "";
    let authToken = "";

    if (teamId) {
      const tenantTwilio = await getTwilioConfig(teamId);
      if (tenantTwilio) {
        accountSid = tenantTwilio.accountSid;
        authToken = tenantTwilio.authToken;
      }
    }

    if ((!accountSid || !authToken) && (isPlatformAdmin || isWebhookAuth)) {
      accountSid = process.env.TWILIO_ACCOUNT_ID || "";
      authToken = process.env.TWILIO_AUTH_TOKEN || "";
    }

    if (!accountSid || !authToken) {
      return NextResponse.json({ error: "Twilio credentials not configured for this team" }, { status: 403 });
    }

    const twilioUrl = twilioApiUrl(accountSid, `/Calls/${callSid}.json`);
    const res = await fetch(twilioUrl, {
      headers: {
        Authorization: twilioAuthHeader(accountSid, authToken),
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ status: "completed" });
      }
      return NextResponse.json({ error: `Twilio ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ status: data.status || "unknown" });
  } catch (e: any) {
    systemLogger.error("[CALL_STATUS]", e?.message);
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET || process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) {
    systemLogger.error("[CALL_STATUS_POST] Missing ELEVENLABS_WEBHOOK_SECRET / VOICE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (!verifyWebhookSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
