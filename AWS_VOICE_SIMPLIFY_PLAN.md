# AWS Voice Simplification Plan (No local mixer)

Goal: Keep AWS, avoid running/maintaining a local SIP mixer. Use managed services to bridge PSTN, provide the agent a browser softphone, and integrate Azure OpenAI Realtime for guidance/transcript.

## Why the container took long to start
- First-time image pull: large base image + many layers from Docker Hub.
- Port bindings: mapping 10000–20000 UDP creates thousands of host bindings; narrowed to 10000–10100 speeds up.
- Missing asterisk.conf: container fell back to built-in defaults repeatedly, causing log spam.
- Extra init services (nftables/websmsd) in the chosen image add startup time.

These are now addressed and the container is healthy, but we’ll pivot to AWS-managed components to avoid this complexity entirely.

## Simplified AWS architecture
- Outbound/inbound PSTN: Amazon Connect handles carrier and bridging. Agents use the embedded CCP (already in your repo: components/voice/ConnectCCP.tsx).
- Automation: Amazon Chime SIP Media Application (SMA) can initiate/close calls and interact via prompts (Speak/DTMF), but we won’t rely on a custom mixer. For pure outbound automation, Connect also supports API-triggered dials.
- Agent AI (Azure OpenAI Realtime): run the Realtime WebRTC session in the browser alongside CCP. Use agent mic or available call audio for guidance and transcript.
- Transcript options:
  - Use Amazon Connect Contact Lens (native) for real-time transcript + sentiment; or
  - Capture agent mic audio to Azure Realtime; for full call audio, consider Connect Live Media Streaming to Kinesis and bridge to Azure (advanced option).

## Implementation steps
1) Amazon Connect setup
   - Ensure Connect instance is provisioned; claim or associate an outbound phone number.
   - Create a simple outbound contact flow (queue, whisper, recording as needed).
   - Verify embedded CCP loads in your app with the instanceId and CCP URL.

2) Outbound call initiation (Connect-native)
   - From your `/app/api/outreach/call/initiate` route, call the Connect API to start an outbound contact to the lead using a queue/agent.
   - Agent answers via CCP; Connect fully bridges PSTN ↔ CCP. No mixer required.

3) Azure Realtime session (browser)
   - Use your existing AzureSalesAgentPanel to create a WebRTC connection to Azure Realtime for guidance and transcript (agent mic as input).
   - Option (advanced): integrate Connect Live Media Streaming to forward mixed call audio into Azure if needed for caller-side transcript.

4) Optional: Chime SIP Media Application for IVR automation (edge cases)
   - Keep the SMA Lambda for cases where you need pre-call IVR or follow-up automation, but remove the dependence on a local SIP mixer.

## Notes on Twilio-like simplicity
Twilio Functions provide a turnkey serverless voice ↔ WebRTC bridge, very quick to prototype. On AWS, the closest simplification is:
- Use Amazon Connect for the voice leg and CCP for the browser leg (no custom mixer).
- Pair this with your browser Azure Realtime session for AI guidance/transcripts.

This achieves the simplicity you’re seeking while staying in AWS.

## Next actions (proposed)
- Wire `/app/api/outreach/call/initiate` to Amazon Connect outbound API.
- Confirm CCP embeds and is authorized for agents.
- Start Azure Realtime alongside CCP for guidance/transcript.
- Defer SMA-only flows to specific automation needs; remove mixer references from Lambda.

## References
- Amazon Connect CCP: https://docs.aws.amazon.com/connect/latest/adminguide/ccp.html
- Amazon Connect StartOutboundVoiceContact: https://docs.aws.amazon.com/connect/latest/APIReference/API_StartOutboundVoiceContact.html
- Azure OpenAI Realtime WebRTC: https://learn.microsoft.com/azure/ai-services/openai/concepts-realtime
