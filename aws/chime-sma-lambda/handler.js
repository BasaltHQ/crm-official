const { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } = require("@aws-sdk/client-chime-sdk-meetings");
const fs = require("fs");
const JOIN_CACHE_PATH = "/tmp/sma-join-cache.json";
function readJoinCache() {
  try {
    const buf = fs.readFileSync(JOIN_CACHE_PATH);
    return JSON.parse(buf.toString("utf-8"));
  } catch (_e) {
    return {};
  }
}
function writeJoinCache(obj) {
  try {
    fs.writeFileSync(JOIN_CACHE_PATH, JSON.stringify(obj));
  } catch (e) {
    console.error("[SMA_JOIN_CACHE_WRITE_ERROR]", e);
  }
}

const REGION = process.env.CHIME_REGION || process.env.AWS_REGION || "us-west-2";
const MEETING_REGION = process.env.CHIME_APP_MEETING_REGION || REGION;
const chime = new ChimeSDKMeetingsClient({ region: REGION });

function getEnv(name, required = false) {
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) throw new Error(`Missing env var: ${name}`);
  return v && String(v).trim();
}

/**
 * SIP Media Application Lambda handler (advanced)
 * - Handles NEW_INBOUND_CALL with Speak + optional CallAndBridge
 * - Handles NEW_OUTBOUND_CALL and attempts JoinChimeMeeting using meetingId/joinToken from SipHeaders/Attributes
 * - Emits helpful logs for diagnostics
 */
exports.handler = async (event) => {
  console.log("[SMA_EVENT]", JSON.stringify(event));

  const type = event && event.InvocationEventType;

  // Inbound leg: greet and optionally bridge
  if (type === "NEW_INBOUND_CALL") {
    try {
      const meetingRes = await chime.send(new CreateMeetingCommand({
        ClientRequestToken: `${Date.now()}_${Math.floor(Math.random() * 1e9)}`,
        MediaRegion: MEETING_REGION,
        ExternalMeetingId: `sma-${Date.now()}`,
      }));
      const meeting = meetingRes && meetingRes.Meeting;
      if (!meeting || !meeting.MeetingId) {
        return { SchemaVersion: "1.0", Actions: [{ Type: "Hangup" }] };
      }

      await chime.send(new CreateAttendeeCommand({
        MeetingId: meeting.MeetingId,
        ExternalUserId: `sma-${Math.floor(Math.random() * 1e9)}`,
      }));

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

  // Outbound leg: attempt to join PSTN leg (LEG-A) to an existing Chime meeting via JoinChimeMeeting
  if (type === "NEW_OUTBOUND_CALL") {
    try {
      const participants = (event && event.CallDetails && event.CallDetails.Participants) || [];
      const legA = participants.find((p) => p && p.ParticipantTag === "LEG-A");

      const rawHeaders = (event && event.CallDetails && event.CallDetails.SipHeaders)
        || (event && event.ActionData && event.ActionData.Parameters && event.ActionData.Parameters.SipHeaders)
        || (event && event.CallDetails && event.CallDetails.ReceivedHeaders)
        || {};
      const attrs = (event && event.CallDetails && event.CallDetails.Attributes) || {};
      const args = (event && event.ActionData && event.ActionData.Parameters && (event.ActionData.Parameters.Arguments || event.ActionData.Parameters.ArgumentsMap)) || {};
      const merged = Object.assign({}, attrs, args);

      const getVal = (obj, k) => {
        if (!obj) return undefined;
        const keys = [k, k && k.toLowerCase(), k && k.toUpperCase()];
        for (const key of keys) {
          if (key && obj[key] !== undefined) return obj[key];
        }
        return undefined;
      };
      const fetchAny = (k) => getVal(rawHeaders, k) || getVal(merged, k);

      let meetingId =
        fetchAny("X-Meeting-Id") || fetchAny("x-meeting-id") || fetchAny("X_MEETING_ID") ||
        fetchAny("MeetingId") || fetchAny("MEETING_ID") || fetchAny("meetingid") || fetchAny("meeting_id");
      const attendeeId =
        fetchAny("X-Attendee-Id") || fetchAny("x-attendee-id") || fetchAny("X_ATTENDEE_ID") ||
        fetchAny("AttendeeId") || fetchAny("ATTENDEE_ID") || fetchAny("attendeeid") || fetchAny("attendee_id");
      let joinToken =
        fetchAny("X-Join-Token") || fetchAny("x-join-token") || fetchAny("X_JOIN_TOKEN") ||
        fetchAny("JoinToken") || fetchAny("JOIN_TOKEN") || fetchAny("jointoken") || fetchAny("join_token");

      console.log("[SMA_OUTBOUND_HEADERS]", {
        meetingId,
        attendeeId,
        hasJoinToken: !!joinToken,
        legACallId: legA && legA.CallId,
        attrs,
        arguments: args,
        receivedHeaders: rawHeaders,
      });

      if (meetingId && joinToken && legA && legA.CallId) {
        const txnId = event && event.CallDetails && event.CallDetails.TransactionId;
        const cache = readJoinCache();
        cache[txnId] = { meetingId: String(meetingId), joinToken: String(joinToken), legACallId: legA && legA.CallId };
        writeJoinCache(cache);
        return {
          SchemaVersion: "1.0",
          Actions: [
            {
              Type: "JoinChimeMeeting",
              Parameters: {
                CallId: legA.CallId,
                MeetingId: String(meetingId),
                JoinToken: String(joinToken),
              },
            },
          ],
        };
      }
    } catch (e) {
      console.error("[SMA_NEW_OUTBOUND_PARSE_HEADERS_ERROR]", e);
    }

    // Fallback: either bridge to a URI or speak a short prompt
    const bridgeUri = getEnv("CHIME_BRIDGE_ENDPOINT_URI");
    const callerId = getEnv("CHIME_SOURCE_PHONE") || getEnv("CHIME_SMA_PHONE_NUMBER");
    const actions = bridgeUri
      ? [
          {
            Type: "CallAndBridge",
            Parameters: {
              Endpoints: [{ Uri: bridgeUri }],
              CallerIdNumber: callerId,
              CallTimeoutSeconds: 60,
            },
          },
        ]
      : [
          {
            Type: "Speak",
            Parameters: {
              Text: "Connecting your call.",
              Engine: "neural",
              LanguageCode: "en-US",
              VoiceId: "Joanna",
            },
          },
        ];
    return { SchemaVersion: "1.0", Actions: actions };
  }

  // After any action succeeds, briefly pause instead of repeating prompts
  if (type === "ACTION_SUCCESS" || type === "ACTION_SUCCESSFUL") {
    console.log("[SMA_ACTION_SUCCESS]", {
      participants: event && event.CallDetails && event.CallDetails.Participants,
      lastActionType: event && event.ActionData && event.ActionData.Type,
      callId: event && event.CallDetails && event.CallDetails.CallId,
    });
    return {
      SchemaVersion: "1.0",
      Actions: [
        {
          Type: "Pause",
          Parameters: {
            DurationInMilliseconds: 15000,
          },
        },
      ],
    };
  }

  // When the outbound leg is answered, attempt to join to the Chime meeting
  if (type === "CALL_ANSWERED") {
    try {
      const participants = (event && event.CallDetails && event.CallDetails.Participants) || [];
      const legA = participants.find((p) => p && p.ParticipantTag === "LEG-A");
      const callId = (legA && legA.CallId) || (event && event.CallDetails && event.CallDetails.CallId);
      const rawHeaders = (event && event.CallDetails && event.CallDetails.SipHeaders)
        || (event && event.ActionData && event.ActionData.Parameters && event.ActionData.Parameters.SipHeaders)
        || (event && event.CallDetails && event.CallDetails.ReceivedHeaders)
        || {};
      const attrs = (event && event.CallDetails && event.CallDetails.Attributes) || {};
      const args = (event && event.ActionData && event.ActionData.Parameters && (event.ActionData.Parameters.Arguments || event.ActionData.Parameters.ArgumentsMap)) || {};
      const merged = Object.assign({}, attrs, args);

      const getVal = (obj, k) => {
        if (!obj) return undefined;
        const keys = [k, k && k.toLowerCase(), k && k.toUpperCase()];
        for (const key of keys) {
          if (key && obj[key] !== undefined) return obj[key];
        }
        return undefined;
      };
      const fetchAny = (k) => getVal(rawHeaders, k) || getVal(merged, k);

      let meetingId =
        fetchAny("X-Meeting-Id") || fetchAny("x-meeting-id") || fetchAny("X_MEETING_ID") ||
        fetchAny("MeetingId") || fetchAny("MEETING_ID") || fetchAny("meetingid") || fetchAny("meeting_id");
      let joinToken =
        fetchAny("X-Join-Token") || fetchAny("x-join-token") || fetchAny("X_JOIN_TOKEN") ||
        fetchAny("JoinToken") || fetchAny("JOIN_TOKEN") || fetchAny("jointoken") || fetchAny("join_token");
      // Fallback to cached values from NEW_OUTBOUND_CALL
      try {
        const txnId = event && event.CallDetails && event.CallDetails.TransactionId;
        const cached = readJoinCache()[txnId] || {};
        if (!meetingId && cached.meetingId) meetingId = cached.meetingId;
        if (!joinToken && cached.joinToken) joinToken = cached.joinToken;
      } catch (e) {
        console.error("[SMA_JOIN_CACHE_READ_ERROR]", e);
      }

      console.log("[SMA_CALL_ANSWERED]", { meetingId, hasJoinToken: !!joinToken, callId, attrs, arguments: args, receivedHeaders: rawHeaders });
      if (meetingId && joinToken && callId) {
        return {
          SchemaVersion: "1.0",
          Actions: [
            {
              Type: "JoinChimeMeeting",
              Parameters: {
                CallId: String(callId),
                MeetingId: String(meetingId),
                JoinToken: String(joinToken),
              },
            },
          ],
        };
      }
    } catch (e) {
      console.error("[SMA_CALL_ANSWERED_ERROR]", e);
    }
    // Keep the call alive while we continue setup
    return {
      SchemaVersion: "1.0",
      Actions: [
        {
          Type: "Speak",
          Parameters: {
            Text: "Connecting your call.",
            Engine: "neural",
            LanguageCode: "en-US",
            VoiceId: "Joanna",
          },
        },
      ],
    };
  }

  // Default for unsupported events: keep the call alive quietly to avoid immediate hangups
  return {
    SchemaVersion: "1.0",
    Actions: [
      {
        Type: "Pause",
        Parameters: {
          DurationInMilliseconds: 10000,
        },
      },
    ],
  };
};
