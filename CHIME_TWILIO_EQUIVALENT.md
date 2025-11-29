# AWS alternative to Twilio Programmable Voice for WebRTC <-> PSTN

Short answer: Yes. Use the Amazon Chime SDK PSTN Audio features together with Amazon Chime Voice Connector and SIP Media Applications (SMA). This stack is AWS’s closest equivalent to Twilio Programmable Voice. It lets you build programmable telephony, bridge PSTN and WebRTC, run Lambda logic on call events, and play/speak audio.

Key AWS building blocks
- Amazon Chime SDK (WebRTC): Browser/mobile SDK to send/receive real‑time audio/video and data.
- Amazon Chime SDK PSTN Audio: Add PSTN calling capabilities to your apps (origination/termination).
- Amazon Chime Voice Connector: SIP trunk to the PSTN; purchase/port phone numbers, route inbound/outbound.
- SIP Media Applications (SMA) + Lambda: Serverless call control. Handle INVITE/DTMF events, issue actions like CallAndBridge, Speak, PlayAudio, Hangup.
- (Optional) Media pipelines/analytics: Record/transcribe/analyze media streams.

Why this is different from Amazon Connect
- Connect is a managed contact center optimized for agents and flows. It does not expose a generic media bridge for arbitrary third‑party audio injection.
- Chime SDK + Voice Connector + SMA is the programmable telephony stack—closest to Twilio’s model.

Reference docs
- Chime SDK overview: https://docs.aws.amazon.com/chime-sdk/latest/dg/what-is-chime-sdk.html
- PSTN Audio (high level): https://docs.aws.amazon.com/chime-sdk/latest/dg/pstn.html
- Voice Connector & SIP Media Applications: https://docs.aws.amazon.com/chime-sdk/latest/dg/sip-media-applications.html

Architecture: Bridge Azure OpenAI Realtime (WebRTC) to PSTN via Chime SDK
1) Web client side (agent/bot side)
   - Establish Azure OpenAI Realtime WebRTC for LLM suggestions and TTS output.
   - Establish an Amazon Chime SDK meeting (WebRTC) in the same page using the Chime JS SDK.
   - Route Azure TTS audio into the Chime meeting as the outgoing track (use Web Audio API to create a MediaStream from Azure’s audio and set it as the SDK’s microphone input). This publishes your AI audio into the meeting.
   - If the agent needs to speak too, mix mic + Azure TTS via Web Audio (GainNodes/Merger) before sending to the meeting.

2) PSTN side
   - Purchase a phone number on Voice Connector (or port one) and enable termination/origination.
   - Create a SIP Media Application with a Lambda handler. For inbound calls, the SMA Lambda can:
     - Create/join a Chime SDK meeting (CreateMeeting/CreateAttendee) on demand.
     - Use CallAndBridge (or equivalent SMA actions) to connect the PSTN leg into that meeting (or into a conference/bridge you control).
   - For outbound dialing, your app can ask SMA to originate a PSTN call and bridge it to the same meeting.

3) Result
   - PSTN caller joins a Chime meeting leg controlled by your Lambda.
   - Your browser publishes Azure TTS (and/or mic) into the meeting leg, providing full‑duplex audio between Azure/agent and PSTN.
   - You maintain full programmatic control (SMA actions) similar to Twilio: play audio, speak SSML, gather DTMF, record, hangup.

Implementation outline
- Provision Voice Connector (buy number, enable routing).
- Create a SIP Media Application and a SIP rule that routes calls for your number to the SMA.
- Implement the SMA Lambda to:
  - On INVITE: Create (or reuse) a Chime meeting and return actions to bridge the PSTN call into that meeting.
  - Optionally accept an external meeting ID to correlate calls with your web sessions.
- Web app:
  - Create a Chime meeting/attendee using your backend, return JoinInfo to the browser.
  - Browser joins the meeting with Chime SDK and sets its outbound audio track to Azure TTS (and/or mixed with mic) using Web Audio API.
- Optional: Use Chime media pipeline/transcribe for server‑side transcript, feed text back into Azure prompt context.

Notes & trade‑offs
- Latency: Web Audio mixing + double WebRTC hops add some latency; keep buffers small and test end‑to‑end.
- Echo control: If mixing mic + TTS, enable echo cancellation and carefully manage monitoring.
- Costs/ops: You will operate Voice Connector numbers, SMA Lambdas, and Chime SDK meetings (pay‑for‑use).
- Security: Gate meeting creation with server auth; don’t expose raw Join tokens to the public.

If you want, I can scaffold:
- A minimal SMA Lambda (TypeScript) that creates/bridges to a Chime meeting.
- A Next.js backend endpoint to create meeting/attendee for the browser.
- A client snippet that injects Azure Realtime audio into a Chime meeting using Web Audio API.
