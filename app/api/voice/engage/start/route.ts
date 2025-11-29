import { NextResponse } from "next/server";
import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } from "@aws-sdk/client-chime-sdk-meetings";
import { createSipMediaApplicationCall } from "@/lib/aws/chime-voice";

/**
 * POST /api/voice/engage/start
 * Orchestrates a smooth meeting-bridged outbound call with optional Azure Realtime agent.
 *
 * Flow:
 * 1) Create a Chime Meeting and a primary attendee (host/user)
 * 2) If includeAgent=true, POST to the Gateway /start-bot to launch the AgentBot into the meeting
 * 3) Create a dedicated PSTN attendee and initiate an SMA outbound call with SIP headers to bridge the callee into the meeting
 * 4) Return session details (meeting, attendees, agent status, transactionId)
 *
 * Request Body:
 * { phone: string (E.164), includeAgent?: boolean, leadId?: string, attributes?: Record<string,string> }
 *
 * Env required:
 * - CHIME_REGION or AWS_REGION
 * - CHIME_APP_MEETING_REGION (optional; defaults to CHIME_REGION/AWS_REGION)
 * - AZURE_GATEWAY_URL: base URL of the Azure Realtime Gateway (e.g., https://<fqdn>)
 * - GATEWAY_SHARED_SECRET: shared secret required by the Gateway (sent as x-gateway-secret)
 * - CHIME_SMA_APPLICATION_ID: SIP Media Application ID
 * - CHIME_SOURCE_PHONE: optional default FromPhoneNumber
 */

type Body = {
  phone: string;
  includeAgent?: boolean;
  leadId?: string;
  attributes?: Record<string, string>;
};

function isE164(num: string) {
  return /^\+[1-9]\d{1,14}$/.test(num);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const dest = (body?.phone || "").trim();
    const wallet = (req.headers.get("x-wallet") || "").trim().toLowerCase();
    if (!dest || !isE164(dest)) {
      return new NextResponse("Invalid or missing phone (E.164)", { status: 400 });
    }

const REGION = process.env.CHIME_REGION || process.env.AWS_REGION || "us-west-2";
const MEETING_REGION = process.env.CHIME_APP_MEETING_REGION || REGION;

    const meetingsClient = new ChimeSDKMeetingsClient({ region: REGION });

    // 1) Create meeting and a primary attendee (host)
    const meetingRes = await meetingsClient.send(new CreateMeetingCommand({
      ClientRequestToken: `${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
      MediaRegion: MEETING_REGION,
      ExternalMeetingId: `engage-${Date.now()}`,
    }));
    const meeting = meetingRes.Meeting;
    if (!meeting?.MeetingId) return new NextResponse("Failed to create meeting", { status: 500 });

    const hostAttendeeRes = await meetingsClient.send(new CreateAttendeeCommand({
      MeetingId: meeting.MeetingId,
      ExternalUserId: `host-${Math.floor(Math.random() * 1e9)}`,
    }));
    const hostAttendee = hostAttendeeRes.Attendee;


    // Sync latest system prompt from VoiceHub for this wallet (idempotent)
    const voicehubBase = (process.env.VOICEHUB_BASE_URL || process.env.NEXT_PUBLIC_VOICEHUB_BASE_URL || "").replace(/\/+$/, "");
    try {
      if (voicehubBase && wallet) {
        let promptConfig: { prompt?: string; meta?: any } | null = null;
        const pr = await fetch(`${voicehubBase}/api/crm/prompt/pull`, {
          method: "GET",
          headers: { "x-wallet": wallet }
        });
        if (pr.ok) {
          const pj = await pr.json().catch(() => ({}));
          const stored = pj?.stored || {};
          promptConfig = { prompt: stored?.prompt, meta: stored?.meta };
        }
        if (promptConfig?.prompt) {
          await fetch(`${voicehubBase}/api/crm/prompt/push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-wallet": wallet },
            body: JSON.stringify({
              wallet,
              prompt: promptConfig.prompt,
              meta: promptConfig.meta,
              ts: Date.now(),
              source: "ledger1crm",
            }),
          });
        }
      }
    } catch {}

    // 3) Create a dedicated attendee for PSTN leg and call out via SMA
    const pstnAttendeeRes = await meetingsClient.send(new CreateAttendeeCommand({
      MeetingId: meeting.MeetingId,
      ExternalUserId: `pstn-${Math.floor(Math.random() * 1e9)}`,
    }));
    const pstnAttendee = pstnAttendeeRes.Attendee;
    if (!pstnAttendee?.AttendeeId || !pstnAttendee?.JoinToken) {
      return new NextResponse("Failed to create PSTN attendee", { status: 500 });
    }

    // Build Attributes for SMA (string values only)
    const attributesRaw = Object.assign(
      {},
      body?.attributes || {},
      body?.leadId ? { leadId: String(body.leadId) } : {},
      {
        MeetingId: meeting.MeetingId,
        AttendeeId: pstnAttendee.AttendeeId,
        JoinToken: pstnAttendee.JoinToken,
        MeetingRegionEnv: MEETING_REGION,
        SMARegionEnv: REGION,
      },
    );
    const attributes: Record<string, string> = Object.fromEntries(
      Object.entries(attributesRaw)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, typeof v === "string" ? v : String(v)])
    );

    // SIP headers to convey meeting join info to the SMA workflow/bridge
    const sipHeaders = {
      "x-meeting-id": meeting.MeetingId,
      "x-attendee-id": pstnAttendee.AttendeeId,
      "x-join-token": pstnAttendee.JoinToken,
      ...(body?.leadId ? { "x-lead-id": String(body.leadId) } : {}),
    } as Record<string, string>;

    const { transactionId } = await createSipMediaApplicationCall({
      destinationPhoneNumber: dest,
      argumentsMap: attributes,
      sipHeaders,
    });

    // 4) Return session details
    const meetingArn = (meeting as any)?.MeetingArn || null;
    const accountId = meetingArn ? (String(meetingArn).split(":")[4] || null) : null;

    return NextResponse.json({
      ok: true,
      meeting,
      hostAttendee,
      pstnAttendee,
      meta: { region: REGION, meetingRegion: MEETING_REGION, meetingArn, accountId },
      call: { destination: dest, transactionId },
    }, { status: 200 });
  } catch (e: any) {
    console.error("[ENGAGE_START]", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 500 });
  }
}
