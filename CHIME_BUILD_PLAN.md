# Chime SDK PSTN Bridge Build Plan (Twilio‑style) for Azure Realtime

Objective
- Use AWS Chime SDK + Voice Connector + SIP Media Applications (SMA) to bridge full‑duplex audio between your web app (WebRTC) and PSTN.
- Keep Amazon Connect for email/SMS only. Phone calls are handled by Chime SDK stack.

High‑level Architecture
- Browser side:
  - Azure OpenAI Realtime WebRTC provides TTS/audio + suggestions.
  - Amazon Chime SDK Meeting provides the WebRTC leg for PSTN bridging.
  - We feed Azure TTS (and optionally microphone) into the Chime meeting using Web Audio API as the meeting’s audio input device.
- PSTN side:
  - Amazon Chime Voice Connector owns phone numbers and PSTN routing.
  - SIP Media Application (SMA) + Lambda handles inbound/outbound call control and bridges PSTN legs into your Chime meeting.

Services and Packages
- AWS services: Chime SDK Meetings, Chime Voice Connector, SIP Media Applications (Lambda), IAM, CloudWatch Logs.
- NPM: amazon-chime-sdk-js, @aws-sdk/client-chime-sdk-meetings.

Environment variables (.env.local.example additions)
- CHIME_REGION=us-west-2
- CHIME_SMA_PHONE_NUMBER=+1XXXXXXXXXX (once purchased/ported on Voice Connector)
- CHIME_APP_MEETING_REGION=us-west-2 (meeting media region)

Provisioning Steps (AWS Console/CLI)
1) Voice Connector & Phone Numbers
   - Create a Chime Voice Connector in your region (e.g., us-west-2). Enable Termination and Origination as needed.
   - Claim or port a phone number to the Voice Connector.

2) SIP Media Application & SIP Rule
   - Create an SMA (SIP Media Application) with a Lambda target (runtime: Node 18+).
   - Create a SIP Rule that routes PSTN calls for your phone number to the SMA.
   - Grant Lambda permission for Chime SDK and logging.

3) IAM
   - Lambda role policy: chime:CreateMeeting, chime:CreateAttendee, chime:DeleteMeeting, logs:*, execute-api:Invoke (if using API), states if using Step Functions (optional).

4) Meeting API (Next.js backend)
   - Add an API route to create Chime meetings/attendees on‑demand for your browser to join.

5) Client Join & Audio Injection
   - Use amazon-chime-sdk-js to join the meeting.
   - Use Web Audio API to set the meeting’s audio input device to a MediaStream that contains Azure Realtime TTS (optionally mixed with mic).

---

SMA Lambda Handler (TypeScript example)
File suggestion: aws/chime-sma-lambda/handler.ts
```ts
import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } from "@aws-sdk/client-chime-sdk-meetings";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";

const REGION = process.env.CHIME_REGION || "us-west-2";
const chime = new ChimeSDKMeetingsClient({ region: REGION });

// SMA invokes Lambda with SIP/DTMF events. We return an actions array, e.g., CallAndBridge, Speak, Hangup.
// See: https://docs.aws.amazon.com/chime-sdk/latest/dg/sip-media-applications.html
export const handler = async (event: any) => {
  console.log("SMA event:", JSON.stringify(event));

  // Create or reuse a meeting on INVITE
  if (event.InvocationEventType === "NEW_INBOUND_CALL" || event.InvocationEventType === "ACTION_SUCCESS") {
    // Optionally use a correlation ID (e.g., from SIP headers) to reuse meetings
    const MeetingRes = await chime.send(new CreateMeetingCommand({
      ClientRequestToken: `${Date.now()}-${Math.random()}`,
      MediaRegion: process.env.CHIME_APP_MEETING_REGION || REGION,
    }));
    if (!MeetingRes.Meeting?.MeetingId) {
      return { SchemaVersion: "1.0", Actions: [{ Type: "Hangup" }] };
    }

    // Use CallAndBridge (or equivalent) to connect PSTN leg into the meeting’s audio bridge
    // Some patterns: Create SIP trunk to a conference bridge, or use SMA action to bridge to an AWS resource that mixes media.
    // Example SMA action (pseudo; update to actual SMA action schema):
    const actions = [
      {
        Type: "CallAndBridge",
        Parameters: {
          CallTimeoutSeconds: 60,
          // DestinationPhoneNumber could be a media bridge entry point managed by your app
          // In advanced patterns, you can bridge PSTN leg to a conference/bridge service that feeds into Chime.
          Endpoints: [
            { Uri: `app:chime-meeting:${MeetingRes.Meeting.MeetingId}` }
          ]
        }
      }
    ];

    return { SchemaVersion: "1.0", Actions: actions };
  }

  // Default: hang up on unknown events
  return { SchemaVersion: "1.0", Actions: [{ Type: "Hangup" }] };
};
```
Notes:
- SMA action shapes vary; adjust to the exact Chime SDK SMA action model available in your region (the above is illustrative to demonstrate intent).
- Many implementations bridge PSTN to a meeting/conference controlled by your backend.

---

Next.js API to Create Meeting/Attendee
File: app/api/voice/chime/create-meeting/route.ts
```ts
import { NextResponse } from "next/server";
import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } from "@aws-sdk/client-chime-sdk-meetings";

const REGION = process.env.CHIME_REGION || "us-west-2";
const MEETING_REGION = process.env.CHIME_APP_MEETING_REGION || REGION;

export async function POST() {
  try {
    const client = new ChimeSDKMeetingsClient({ region: REGION });
    const meetingRes = await client.send(new CreateMeetingCommand({
      ClientRequestToken: `${Date.now()}-${Math.random()}`,
      MediaRegion: MEETING_REGION,
    }));
    const meeting = meetingRes.Meeting;
    if (!meeting?.MeetingId) return new NextResponse("Failed to create meeting", { status: 500 });

    const attendeeRes = await client.send(new CreateAttendeeCommand({
      MeetingId: meeting.MeetingId,
      ExternalUserId: `user-${Math.floor(Math.random() * 1e6)}`,
    }));

    return NextResponse.json({ meeting, attendee: attendeeRes.Attendee });
  } catch (e: any) {
    console.error("[CHIME_CREATE_MEETING]", e);
    return new NextResponse(e?.message || "error", { status: 500 });
  }
}
```

---

Client: Join Chime Meeting & Inject Azure Audio
File: components/voice/ChimeBridgePanel.tsx
```tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ConsoleLogger,
  DefaultDeviceController,
  DefaultMeetingSession,
  LogLevel,
  MeetingSessionConfiguration,
} from "amazon-chime-sdk-js";

export default function ChimeBridgePanel() {
  const [active, setActive] = useState(false);
  const azureAudioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<DefaultMeetingSession | null>(null);

  async function start() {
    // 1) Fetch Chime JoinInfo
    const res = await fetch("/api/voice/chime/create-meeting", { method: "POST" });
    const joinInfo = await res.json();

    // 2) Create Chime meeting session
    const logger = new ConsoleLogger("SDK", LogLevel.INFO);
    const deviceController = new DefaultDeviceController(logger);
    const config = new MeetingSessionConfiguration(joinInfo.meeting, joinInfo.attendee);
    const session = new DefaultMeetingSession(config, logger, deviceController);
    sessionRef.current = session;

    // 3) Create a MediaStream with Azure TTS (or mix of mic + Azure)
    // For demo: assume you already have an <audio> element playing Azure TTS with capture stream
    // Modern browsers: audioEl.captureStream() or mediaElement.captureStream()
    const audioEl = azureAudioRef.current!; // This should be fed by your Azure Realtime connection
    const ttsStream = (audioEl as any).captureStream?.() as MediaStream;

    // Optional: Mix mic + TTS with Web Audio
    // const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    // const ctx = new AudioContext();
    // const dest = ctx.createMediaStreamDestination();
    // ctx.createMediaStreamSource(ttsStream).connect(dest);
    // ctx.createMediaStreamSource(mic).connect(dest);
    // const mixed = dest.stream;

    // 4) Set audio input to TTS stream (or mixed stream)
    if (ttsStream) {
      await session.audioVideo.chooseAudioInputDevice(ttsStream);
    } else {
      // fallback to mic only
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      await session.audioVideo.chooseAudioInputDevice(mic);
    }

    // 5) Start audio
    await session.audioVideo.start();
    setActive(true);
  }

  function stop() {
    try { sessionRef.current?.audioVideo?.stop(); } catch {}
    setActive(false);
  }

  return (
    <div className="rounded border p-2">
      <div className="text-xs font-semibold mb-2">Chime PSTN Bridge (WebRTC <-> PSTN)</div>
      <div className="flex gap-2 mb-2">
        <Button onClick={start} disabled={active}>Start Bridge</Button>
        <Button onClick={stop} variant="outline" disabled={!active}>Stop</Button>
      </div>
      {/* This audio element should be driven by your Azure Realtime connection (set srcObject to its remote stream) */}
      <audio ref={azureAudioRef} className="hidden" autoPlay playsInline />
      <div className="text-[11px] text-muted-foreground">Inject Azure TTS/mic into Chime meeting; PSTN is bridged by SMA/Voice Connector.</div>
    </div>
  );
}
```

---

Operational Notes
- Latency: keep Web Audio buffers small; test across networks. Disable unnecessary processing on the Azure stream.
- Echo: if mixing mic+TTS, enable echo cancellation on mic track and avoid playing out the mixed stream locally.
- Security: gate create‑meeting endpoint; sign requests; rotate credentials.
- Costs: pay for Chime meeting minutes, Voice Connector usage, Lambda invocations.

Next Steps
- Confirm you want to proceed with this stack (Voice Connector + SMA Lambda + Chime meeting API + client mixer).
- I can next: (a) scaffold the Next.js API route files and client component, (b) add a starter Lambda directory with a SAM/Serverless template for deployment, (c) prepare an IAM policy JSON for the Lambda role, and (d) write Voice Connector/SIP Rule provisioning commands.
