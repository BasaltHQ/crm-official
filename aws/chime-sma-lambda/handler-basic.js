/**
 * Minimal SIP Media Application Lambda handler (CommonJS, no external deps)
 * Responds to NEW_INBOUND_CALL with a greeting, then hangs up on ACTION_SUCCESS.
 * Use this if you want to deploy quickly without bundling node_modules.
 */
// Simple in-memory cache to carry join info across invocations (best-effort; works when Lambda container stays warm)
const __JOIN_CACHE = {};

exports.handler = async (event) => {
  console.log("[SMA_EVENT]", JSON.stringify(event));
  const type = event && event.InvocationEventType;
  const callDetails = event?.CallDetails || {};
  const txId = callDetails?.TransactionId;
  const participants = (callDetails?.Participants) || [];
  const legA = participants.find((p)=>p.ParticipantTag === "LEG-A");
  // Robust header extraction across possible event locations/keys
  const rawHeaders = (event?.CallDetails?.SipHeaders) || (event?.ActionData?.Parameters?.SipHeaders) || (event?.CallDetails?.ReceivedHeaders) || (event?.CallDetails?.Attributes) || {};
  const args = (event?.ActionData?.Parameters?.Arguments) || {};
  const argsMap = (event?.ActionData?.Parameters?.ArgumentsMap) || {};
  const getHdr = (k) => rawHeaders?.[k] || rawHeaders?.[k.toLowerCase?.()] || rawHeaders?.[k.toUpperCase?.()] || args?.[k] || args?.[k.toLowerCase?.()] || args?.[k.toUpperCase?.()] || argsMap?.[k] || argsMap?.[k.toLowerCase?.()] || argsMap?.[k.toUpperCase?.()];
  let meetingId = getHdr("X-Meeting-Id") || getHdr("X_MEETING_ID") || getHdr("x-meeting-id") || getHdr("MeetingId") || getHdr("MEETING_ID");
  let attendeeId = getHdr("X-Attendee-Id") || getHdr("X_ATTENDEE_ID") || getHdr("x-attendee-id") || getHdr("AttendeeId") || getHdr("ATTENDEE_ID");
  let joinToken = getHdr("X-Join-Token") || getHdr("X_JOIN_TOKEN") || getHdr("x-join-token") || getHdr("JoinToken") || getHdr("JOIN_TOKEN");
  let hasChimeJoin = !!(meetingId && attendeeId && joinToken && legA?.CallId);
  try {
    console.log("[SMA_JOIN_DECISION]", JSON.stringify({
      type,
      meetingIdPresent: !!meetingId,
      attendeeIdPresent: !!attendeeId,
      joinTokenPresent: !!joinToken,
      legACallIdPresent: !!(legA?.CallId),
      hasChimeJoin,
    }));
  } catch {}

  if (type === "NEW_INBOUND_CALL") {
    const speak = {
      Type: "Speak",
      Parameters: {
        Text: "Welcome to Ledger1. Please hold while we connect your call.",
        Engine: "neural",
        LanguageCode: "en-US",
        VoiceId: "Joanna",
      },
    };

    const actions = [speak];
    const bridgeUri = process.env.CHIME_BRIDGE_ENDPOINT_URI;
    const callerId = process.env.CHIME_SOURCE_PHONE || process.env.CHIME_SMA_PHONE_NUMBER;
    if (bridgeUri && bridgeUri.trim()) {
      actions.push({
        Type: "CallAndBridge",
        Parameters: {
          Endpoints: [
            {
              Uri: bridgeUri.trim(),
            },
          ],
          CallerIdNumber: callerId,
          CallTimeoutSeconds: 45,
        },
      });
    }
    return { SchemaVersion: "1.0", Actions: actions };
  }

  // Handle outbound SMA-initiated calls (CreateSipMediaApplicationCall)
  if (type === "NEW_OUTBOUND_CALL") {
    try { console.log("[SMA_OUTBOUND_RAW_HEADERS]", JSON.stringify(rawHeaders)); } catch {}
    try { console.log("[SMA_OUTBOUND_ARGS]", JSON.stringify(args)); } catch {}
    try { console.log("[SMA_OUTBOUND_ARGSMAP]", JSON.stringify(argsMap)); } catch {}
    try { console.log("[SMA_OUTBOUND_ATTRS]", JSON.stringify(event?.CallDetails?.Attributes || {})); } catch {}
    // Cache join details keyed by transaction id for later events (RINGING/CALL_ANSWERED)
    if (txId && meetingId && joinToken) {
      __JOIN_CACHE[txId] = { meetingId, joinToken, attendeeId };
      try { console.log("[SMA_CACHE_SET]", JSON.stringify({ txId, meetingIdPresent: !!meetingId, attendeeIdPresent: !!attendeeId, joinTokenPresent: !!joinToken })); } catch {}
    }
    if (hasChimeJoin) {
      // Defer meeting join until the call is answered; provide holding audio now
      const response = {
        SchemaVersion: "1.0",
        Actions: [
          {
            Type: "Speak",
            Parameters: {
              Text: "Connecting your call. Please hold.",
              Engine: "neural",
              LanguageCode: "en-US",
              VoiceId: "Joanna",
              CallId: legA?.CallId,
            },
          },
        ],
      };
      try { console.log("[SMA_RETURN_DEFER_JOIN_NOCALL]", JSON.stringify({ txId, meetingId, attendeeId, joinToken, response })); } catch {}
      return response;
    }
    // Fallback: Bridge to configured SIP mixer/bridge URI if available
    const bridgeUri = process.env.CHIME_BRIDGE_ENDPOINT_URI;
    const callerId = process.env.CHIME_SOURCE_PHONE || process.env.CHIME_SMA_PHONE_NUMBER;
    if (bridgeUri && bridgeUri.trim()) {
      const response = {
        SchemaVersion: "1.0",
        Actions: [
          {
            Type: "CallAndBridge",
            Parameters: {
              Endpoints: [ { Uri: bridgeUri.trim() } ],
              CallerIdNumber: callerId,
              CallTimeoutSeconds: 45,
            },
          },
        ],
      };
      try { console.log("[SMA_RETURN]", JSON.stringify(response)); } catch {}
      return response;
    }
    // Final fallback: brief prompt
    const actions = [{
      Type: "Speak",
      Parameters: {
        Text: "Please hold.",
        Engine: "neural",
        LanguageCode: "en-US",
        VoiceId: "Joanna",
        CallId: legA?.CallId,
      },
    }];
    const response = { SchemaVersion: "1.0", Actions: actions };
    try { console.log("[SMA_RETURN]", JSON.stringify(response)); } catch {}
    return response;
  }

  // Keep the call alive after answer (defer bridging until gateway is ready)
  if (type === "CALL_ANSWERED" || type === "RINGING") {
    // Diagnostic: show attributes and headers present at this stage
    try { console.log("[SMA_ATTRS]", JSON.stringify(event?.CallDetails?.Attributes || {})); } catch {}
    try { console.log("[SMA_HEADERS]", JSON.stringify(rawHeaders || {})); } catch {}

    // If join details aren't present in the event, try the cache
    if (!hasChimeJoin && txId && __JOIN_CACHE[txId]) {
      const cached = __JOIN_CACHE[txId];
      if (cached?.meetingId && cached?.joinToken) {
        meetingId = cached.meetingId;
        joinToken = cached.joinToken;
        attendeeId = cached.attendeeId;
        hasChimeJoin = !!(meetingId && joinToken && legA?.CallId);
        try { console.log("[SMA_CACHE_HIT]", JSON.stringify({ txId, meetingIdPresent: !!meetingId, attendeeIdPresent: !!attendeeId, joinTokenPresent: !!joinToken, type })); } catch {}
      }
    }
    if (hasChimeJoin && type === "CALL_ANSWERED") {
      // Attempt to join the call to the Chime meeting now that the PSTN leg is connected
      try {
        console.log("[SMA_TOKEN_INFO]", JSON.stringify({
          meetingIdLength: (meetingId||'').length,
          joinTokenLength: (joinToken||'').length,
          callIdPresent: !!(legA?.CallId),
        }));
      } catch {}
      const response = {
        SchemaVersion: "1.0",
        Actions: [
          {
            Type: "JoinChimeMeeting",
            Parameters: {
              CallId: legA?.CallId,
              MeetingId: meetingId,
              JoinToken: joinToken,
            },
          },
        ],
      };
      try { console.log("[SMA_RETURN_JOIN_ON_ANSWER]", JSON.stringify(response)); } catch {}
      return response;
    }
    if (type === "CALL_ANSWERED") {
      // Fallback: provide audio if join attributes are missing
      const response = {
        SchemaVersion: "1.0",
        Actions: [
          {
            Type: "Speak",
            Parameters: {
              Text: "You are connected. Please hold while we finalize the connection.",
              Engine: "neural",
              LanguageCode: "en-US",
              VoiceId: "Joanna",
              CallId: legA?.CallId,
            },
          },
          { Type: "Pause", Parameters: { DurationInMilliseconds: 5000 } },
        ],
      };
      try { console.log("[SMA_RETURN_ANSWER_SPEAK]", JSON.stringify(response)); } catch {}
      return response;
    }
    // Provide immediate audio to caller while bridge/media setup completes
    const response = {
      SchemaVersion: "1.0",
      Actions: [
        {
          Type: "Speak",
            Parameters: {
            Text: "Connecting your call. Please hold.",
            Engine: "neural",
            LanguageCode: "en-US",
            VoiceId: "Joanna",
            CallId: legA?.CallId,
          },
        },
      ],
    };
    try { console.log("[SMA_RETURN]", JSON.stringify(response)); } catch {}
    return response;
  }

  if (type === "ACTION_SUCCESS" || type === "ACTION_SUCCESSFUL") {
    // Provide an audible confirmation and keep-alive to avoid carrier idle disconnect
    return { SchemaVersion: "1.0", Actions: [
      {
        Type: "Speak",
        Parameters: {
          Text: "You are connected. Please start speaking.",
          Engine: "neural",
          LanguageCode: "en-US",
          VoiceId: "Joanna",
          CallId: legA?.CallId,
        },
      },
      {
        Type: "Pause",
        Parameters: {
          DurationInMilliseconds: 15000,
        },
      },
    ] };
  }

  if (type === "ACTION_FAILED") {
    // Join failed or action failed; keep call alive and optionally fallback to bridge
    const bridgeUri = process.env.CHIME_BRIDGE_ENDPOINT_URI;
    const callerId = process.env.CHIME_SOURCE_PHONE || process.env.CHIME_SMA_PHONE_NUMBER;
    const actions = [
      {
        Type: "Speak",
        Parameters: {
          Text: "Unable to connect to the meeting. Please hold.",
          Engine: "neural",
          LanguageCode: "en-US",
          VoiceId: "Joanna",
          CallId: legA?.CallId,
        },
      },
    ];
    if (bridgeUri && bridgeUri.trim()) {
      actions.push({
        Type: "CallAndBridge",
        Parameters: {
          Endpoints: [ { Uri: bridgeUri.trim() } ],
          CallerIdNumber: callerId,
          CallTimeoutSeconds: 45,
        },
      });
    } else {
      actions.push({ Type: "Pause", Parameters: { DurationInMilliseconds: 15000 } });
    }
    return { SchemaVersion: "1.0", Actions: actions };
  }

  if (type === "INVALID_LAMBDA_RESPONSE") {
    // The previous response was not parseable; return a minimal valid actions list to keep the call alive
    const actions = [
      {
        Type: "Speak",
        Parameters: {
          Text: "Connecting your call. Please hold.",
          Engine: "neural",
          LanguageCode: "en-US",
          VoiceId: "Joanna",
          CallId: legA?.CallId,
        },
      },
      { Type: "Pause", Parameters: { DurationInMilliseconds: 10000 } },
    ];
    try { console.log("[SMA_INVALID_RESP_FALLBACK] returning Speak+Pause"); } catch {}
    return { SchemaVersion: "1.0", Actions: actions };
  }

  return { SchemaVersion: "1.0", Actions: [{ Type: "Hangup" }] };
};
