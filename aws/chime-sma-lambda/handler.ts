import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } from "@aws-sdk/client-chime-sdk-meetings";

const REGION = process.env.CHIME_REGION || process.env.AWS_REGION || "us-west-2";
const MEETING_REGION = process.env.CHIME_APP_MEETING_REGION || REGION;
const chime = new ChimeSDKMeetingsClient({ region: REGION });

function getEnv(name: string, required = false): string | undefined {
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) throw new Error(`Missing env var: ${name}`);
  return v?.toString().trim();
}

/**
 * SIP Media Application Lambda handler (prototype)
 * Note: SMA events include InvocationEventType values like NEW_INBOUND_CALL, ACTION_SUCCESS, DIGIT_COLLECTION, etc.
 * We return { SchemaVersion: "1.0", Actions: [...] } with actions such as Speak, CallAndBridge, PlayAudio, Hangup.
 * Adjust actions to match your SMA feature set/region.
 */
export const handler = async (event: any) => {
  console.log("[SMA_EVENT]", JSON.stringify(event));

  const type = event?.InvocationEventType;

  // On a new inbound call, create a meeting and provide a basic greeting, then (placeholder) bridge call.
  if (type === "NEW_INBOUND_CALL") {
    try {
      const meetingRes = await chime.send(new CreateMeetingCommand({
        ClientRequestToken: `${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
        MediaRegion: MEETING_REGION,
        ExternalMeetingId: `sma-${Date.now()}`,
      }));
      const meeting = meetingRes.Meeting;
      if (!meeting?.MeetingId) {
        return { SchemaVersion: "1.0", Actions: [{ Type: "Hangup" }] };
      }

      // Create a dummy attendee for server-side correlation (optional)
      await chime.send(new CreateAttendeeCommand({
        MeetingId: meeting.MeetingId,
        ExternalUserId: `sma-${Math.floor(Math.random() * 1e9)}`,
      }));

      // Speak a greeting to the caller; replace with PlayAudio for custom media or CallAndBridge implementation
      const speak = {
        Type: "Speak",
        Parameters: {
          Text: "Welcome. Please hold while we connect your call.",
          Engine: "neural",
          LanguageCode: "en-US",
          VoiceId: "Joanna",
        },
      };

      const bridgeUri = getEnv("CHIME_BRIDGE_ENDPOINT_URI");
      const callerId = getEnv("CHIME_SOURCE_PHONE") || getEnv("CHIME_SMA_PHONE_NUMBER");
      const actions = bridgeUri
        ? [
            speak,
            {
              Type: "CallAndBridge",
              Parameters: {
                Endpoints: [{ Uri: bridgeUri }],
                CallerIdNumber: callerId,
                CallTimeoutSeconds: 60,
              },
            },
          ]
        : [speak];

      return { SchemaVersion: "1.0", Actions: actions };
    } catch (e) {
      console.error("[SMA_NEW_INBOUND_ERROR]", e);
      return { SchemaVersion: "1.0", Actions: [{ Type: "Hangup" }] };
    }
  }

  // After an action succeeds, you can continue the flow or hang up.
  if (type === "NEW_OUTBOUND_CALL") {
    // Attempt to join the PSTN leg to an existing Chime meeting using JoinToken passed via SipHeaders.
    try {
      const participants = (event?.CallDetails?.Participants || []) as any[];
      const legA = participants.find(p => p?.ParticipantTag === "LEG-A");
      // Headers and attributes can surface in different fields depending on region/runtime
      const rawHeaders = (event?.CallDetails?.SipHeaders || event?.ActionData?.Parameters?.SipHeaders || event?.CallDetails?.ReceivedHeaders || {}) as Record<string, string>;
      const attrs = (event?.CallDetails?.Attributes || {}) as Record<string, string>;
      const getVal = (obj: Record<string, string>, k: string) => obj?.[k] || obj?.[k.toLowerCase()] || obj?.[k.toUpperCase()];
      const fetchAny = (k: string) => getVal(rawHeaders, k) || getVal(attrs, k);

      const meetingId = fetchAny("X-Meeting-Id") || fetchAny("X_MEETING_ID") || fetchAny("x-meeting-id") || fetchAny("MeetingId") || fetchAny("MEETING_ID");
      const attendeeId = fetchAny("X-Attendee-Id") || fetchAny("X_ATTENDEE_ID") || fetchAny("x-attendee-id") || fetchAny("AttendeeId") || fetchAny("ATTENDEE_ID");
      const joinToken = fetchAny("X-Join-Token") || fetchAny("X_JOIN_TOKEN") || fetchAny("x-join-token") || fetchAny("JoinToken") || fetchAny("JOIN_TOKEN");

      console.log("[SMA_OUTBOUND_HEADERS]", { meetingId, attendeeId, hasJoinToken: !!joinToken, legACallId: legA?.CallId, hasAttrs: !!attrs && Object.keys(attrs||{}).length>0 });

      if (meetingId && joinToken && legA?.CallId) {
        // Directly join the outbound PSTN leg (LEG-A) to the specified Chime meeting
        return {
          SchemaVersion: "1.0",
          Actions: [
            {
              Type: "JoinChimeMeeting",
              Parameters: {
                CallId: legA.CallId,
                JoinToken: joinToken,
                MeetingId: meetingId,
              },
            },
          ],
        };
      }
    } catch (e) {
      console.error("[SMA_NEW_OUTBOUND_PARSE_HEADERS_ERROR]", e);
    }

    // Fallback to CallAndBridge if meeting headers are not present
    const bridgeUri = getEnv("CHIME_BRIDGE_ENDPOINT_URI");
    const callerId = getEnv("CHIME_SOURCE_PHONE") || getEnv("CHIME_SMA_PHONE_NUMBER");
    const actions = bridgeUri
      ? [{
          Type: "CallAndBridge",
          Parameters: {
            Endpoints: [{ Uri: bridgeUri }],
            CallerIdNumber: callerId,
          CallTimeoutSeconds: 60,
          },
        }]
      : [{ Type: "Speak", Parameters: { Text: "Connecting your call.", Engine: "neural", LanguageCode: "en-US", VoiceId: "Joanna" } }];
    return { SchemaVersion: "1.0", Actions: actions };
  }

  if (type === "CALL_ANSWERED") {
    try {
      const participants = (event?.CallDetails?.Participants || []) as any[];
      const legA = participants.find(p => p?.ParticipantTag === "LEG-A") || participants[0];
      const rawHeaders = (event?.CallDetails?.SipHeaders || event?.ActionData?.Parameters?.SipHeaders || event?.CallDetails?.ReceivedHeaders || {}) as Record<string, string>;
      const attrs = (event?.CallDetails?.Attributes || {}) as Record<string, string>;
      const getVal = (obj: Record<string, string>, k: string) => obj?.[k] || obj?.[k.toLowerCase()] || obj?.[k.toUpperCase()];
      const fetchAny = (k: string) => getVal(rawHeaders, k) || getVal(attrs, k);
      const meetingId = fetchAny("X-Meeting-Id") || fetchAny("X_MEETING_ID") || fetchAny("x-meeting-id") || fetchAny("MeetingId") || fetchAny("MEETING_ID");
      const joinToken = fetchAny("X-Join-Token") || fetchAny("X_JOIN_TOKEN") || fetchAny("x-join-token") || fetchAny("JoinToken") || fetchAny("JOIN_TOKEN");
      console.log("[SMA_CALL_ANSWERED]", { meetingId, hasJoinToken: !!joinToken, callId: legA?.CallId });
      if (meetingId && joinToken && legA?.CallId) {
        return {
          SchemaVersion: "1.0",
          Actions: [
            {
              Type: "JoinChimeMeeting",
              Parameters: {
                CallId: legA.CallId,
                JoinToken: joinToken,
                MeetingId: meetingId,
              },
            },
          ],
        };
      }
    } catch (e) {
      console.error("[SMA_CALL_ANSWERED_ERROR]", e);
    }
    // No-op to keep call alive if headers not found
    return { SchemaVersion: "1.0", Actions: [] };
  }

  if (type === "ACTION_SUCCESS") {
    const last = event?.ActionData?.Type;
    console.log("[SMA_ACTION_SUCCESS]", {
      participants: event?.CallDetails?.Participants,
      lastActionType: last,
      callId: event?.CallDetails?.CallId,
    });
    // If we just joined the Chime meeting, do NOT speak; keep the bridge active with no-op
    if (String(last) === "JoinChimeMeeting") {
      return { SchemaVersion: "1.0", Actions: [] };
    }
    // Otherwise, short prompt while other actions complete
    return { SchemaVersion: "1.0", Actions: [{ Type: "Speak", Parameters: { Text: "Please hold.", Engine: "neural", LanguageCode: "en-US", VoiceId: "Joanna" } }] };
  }

  // Default: hang up for unsupported events in this prototype
  return { SchemaVersion: "1.0", Actions: [{ Type: "Hangup" }] };
};
