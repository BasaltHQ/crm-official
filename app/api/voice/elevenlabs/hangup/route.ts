import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getSessionAndTeam } from "@/lib/api-utils";
import { getTwilioConfig, twilioApiUrl, twilioAuthHeader } from "@/lib/twilio/twilio-voice";
import { systemLogger } from "@/lib/logger";

type Body = {
  callSid?: string;
  transactionId?: string; // Legacy compat — older UI may still send this
};

export async function POST(req: Request) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const teamId = teamInfo?.teamId;
  if (!teamId) {
    return NextResponse.json({ ok: false, error: "No team context" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Body;
    const callSid = String(body?.callSid || body?.transactionId || "").trim();

    if (!/^CA[0-9a-fA-F]{32}$/.test(callSid)) {
      return NextResponse.json({ ok: false, error: "Invalid or missing callSid" }, { status: 400 });
    }

    const config = await getTwilioConfig(teamId);
    if (!config) {
      return NextResponse.json({ ok: false, error: "Twilio integration not configured. Go to Admin → Integrations to add your Twilio credentials." }, { status: 400 });
    }

    // Call Twilio REST API to terminate the call
    const url = twilioApiUrl(config.accountSid, `/Calls/${callSid}.json`);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": twilioAuthHeader(config.accountSid, config.authToken),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "Status=completed",
    });

    if (!res.ok) {
      const txt = await res.text();
      systemLogger.error(`[TWILIO_HANGUP] Failed for ${callSid}: ${res.status}`, txt);
      return NextResponse.json({ ok: false, error: `Twilio returned ${res.status}` }, { status: res.status });
    }

    systemLogger.info(`[TWILIO_HANGUP] Terminated call ${callSid}`);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    systemLogger.error("[TWILIO_HANGUP_ERROR]", e);
    return NextResponse.json({
      ok: false,
      error: e?.message || "Hangup failed",
    }, { status: 500 });
  }
}
