import { NextResponse } from "next/server";

// Ensure Node.js runtime for AWS SDK compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';
import { ChimeSDKVoiceClient, CreateSipMediaApplicationCallCommand } from "@aws-sdk/client-chime-sdk-voice";

/**
 * POST /api/voice/chime/outbound
 * Body: { destination: string; from?: string }
 * - destination: E.164 phone number (e.g., "+17203703285")
 * - from: optional E.164 to override the default FromPhoneNumber (env)
 *
 * Env required:
 * - CHIME_SMA_ID: SIP Media Application ID (e.g., df0b7497-ac52-4f3a-baa1-a5d75a8ebc30)
 * - CHIME_FROM_PHONE_NUMBER: default E.164 to use for FromPhoneNumber
 * - CHIME_VOICE_REGION: optional, defaults to us-west-2
 */

type Body = {
  destination: string;
  from?: string;
  meetingId?: string;
  leadId?: string;
};

function isE164(num: string) {
  return /^\+[1-9]\d{1,14}$/.test(num);
}

export async function POST(req: Request) {
  try {
    // Read raw text body once and parse JSON to avoid "Body has already been read" errors
    const txt = await req.text();
    let body: Body;
    try {
      body = JSON.parse(txt);
    } catch (err: any) {
      return NextResponse.json({ ok: false, error: { name: 'BadRequest', message: 'Request body must be valid JSON', detail: err?.message || String(err) } }, { status: 400 });
    }

    if (!body || !body.destination || !isE164(body.destination)) {
      return new NextResponse("Invalid destination (must be E.164)", { status: 400 });
    }

const smaId = process.env.CHIME_SMA_APPLICATION_ID || process.env.CHIME_SMA_ID;
const defaultFrom = process.env.CHIME_SOURCE_PHONE || process.env.CHIME_FROM_PHONE_NUMBER;
const region = process.env.CHIME_VOICE_REGION || process.env.AWS_REGION || "us-west-2";

if (!smaId) return new NextResponse("Missing CHIME_SMA_APPLICATION_ID (or CHIME_SMA_ID)", { status: 500 });
const fromNumber = body.from?.trim() || defaultFrom?.trim();
if (!fromNumber || !isE164(fromNumber)) {
  return new NextResponse("Invalid or missing FromPhoneNumber (set CHIME_SOURCE_PHONE or pass body.from)", { status: 400 });
}

    const client = new ChimeSDKVoiceClient({ region });

    // If a meetingId is provided, create a dedicated attendee for the PSTN leg
    let sipHeaders: Record<string, string> | undefined = undefined;
    let argumentsMap: Record<string, string> | undefined = undefined;
    if (body.meetingId && typeof body.meetingId === "string") {
      const { ChimeSDKMeetingsClient, CreateAttendeeCommand } = await import("@aws-sdk/client-chime-sdk-meetings");
      const meetingRegion = process.env.CHIME_APP_MEETING_REGION || process.env.CHIME_REGION || process.env.AWS_REGION || region;
      const meetClient = new ChimeSDKMeetingsClient({ region: meetingRegion });
      const att = await meetClient.send(new CreateAttendeeCommand({
        MeetingId: body.meetingId,
        ExternalUserId: `sma-${Date.now()}-${Math.floor(Math.random()*1e6)}`,
      }));
      const attendeeId = att?.Attendee?.AttendeeId || "";
      const joinToken = att?.Attendee?.JoinToken || "";
      if (attendeeId && joinToken) {
        sipHeaders = {
          // Allowed custom headers should use x- or X- prefix; remove non-X names to avoid BadRequest
          "x-meeting-id": body.meetingId,
          "x-attendee-id": attendeeId,
          "x-join-token": joinToken,
          "X-Meeting-Id": body.meetingId,
          "X-Attendee-Id": attendeeId,
          "X-Join-Token": joinToken,
        };
        argumentsMap = {
          // Pass meeting context via ArgumentsMap as well (include multiple casings for robustness)
          "X-Meeting-Id": body.meetingId,
          "X-Attendee-Id": attendeeId,
          "X-Join-Token": joinToken,
          "MeetingId": body.meetingId,
          "AttendeeId": attendeeId,
          "JoinToken": joinToken,
          // lower-case keys some runtimes prefer
          "meetingid": body.meetingId,
          "attendeeid": attendeeId,
          "jointoken": joinToken,
          // underscore variants observed in some SMA examples
          "meeting_id": body.meetingId,
          "attendee_id": attendeeId,
          "join_token": joinToken,
        };
        if (body.leadId) {
          sipHeaders["x-lead-id"] = String(body.leadId);
          sipHeaders["X-Lead-Id"] = String(body.leadId);
          argumentsMap["X-Lead-Id"] = String(body.leadId);
          argumentsMap["LeadId"] = String(body.leadId);
        }
      }
    }

    const cmd = new CreateSipMediaApplicationCallCommand({
      SipMediaApplicationId: smaId,
      FromPhoneNumber: fromNumber,
      ToPhoneNumber: body.destination.trim(),
      ...(sipHeaders ? { SipHeaders: sipHeaders } : {}),
      ...(argumentsMap ? { ArgumentsMap: argumentsMap } : {}),
    } as any);

    const res = await client.send(cmd);
    return NextResponse.json({ ok: true, result: res }, { status: 200 });
  } catch (e: any) {
    console.error("[CHIME_OUTBOUND_POST]", e);
    return NextResponse.json({
      ok: false,
      error: {
        name: e?.name,
        message: e?.message,
        code: (e as any)?.code,
        stack: e?.stack,
        metadata: (e as any)?.$metadata,
      },
    }, { status: 500 });
  }
}
