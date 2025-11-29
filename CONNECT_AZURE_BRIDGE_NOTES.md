# Amazon Connect vs Azure OpenAI Realtime: Media Bridge Notes

Question: Can we avoid CCP and just use AWS CLI (StartOutboundVoiceContact) so we can pass Azure OpenAI Realtime WebRTC audio to AWS Connect for the live call?

Short answer: No, not directly. StartOutboundVoiceContact initiates a PSTN call (and sets contact attributes), but Amazon Connect does not expose a browser-accessible media "sink" to accept arbitrary third-party WebRTC audio and inject it into that live telephony call. Agent audio must come from either:
- The embedded CCP (Streams softphone) WebRTC session
- A desk phone registered to the agent

And customer audio is delivered over PSTN/SIP to Connect, which you can only observe via supported streaming mechanisms (e.g., Customer Voice Stream to Kinesis, Contact Lens). There is no API to replace the agent’s live audio stream with your own WebRTC source from Azure.

## What StartOutboundVoiceContact actually does
- Dials the destination phone number and attaches the specified Contact Flow to the call.
- Optionally places the call into a queue for routing to agents.
- It does not create a controllable media session for third-party injection; no WebRTC endpoint is exposed to your browser/app.

## Feasible designs

### A) Assist-only (recommended, implemented now)
- Keep CCP for the real call media (agent ↔ customer).
- Run a parallel WebRTC session to Azure Realtime from the browser to analyze the agent mic and produce live suggestions/whisper coaching.
- Use Contact Lens/Transcribe transcripts (real-time or post-call) to give Azure context from the customer side.
- If you want the system to speak to the customer, use Contact Flow PlayPrompt (short phrases) or a Lex bot segment.

### B) Server-side media bridge (advanced/experimental)
- Enable Amazon Connect Customer Voice Stream to Kinesis Video Streams for the call.
- Build a media processor that consumes the Kinesis voice stream (and optionally agent-side audio if available), runs ASR and sends text/audio frames to Azure Realtime.
- For audio back to the customer, you still cannot inject arbitrary real-time audio. Practical options:
  - Whisper to agent via browser (same as A)
  - PlayPrompt snippets to the customer via the Contact Flow (higher latency, not full-duplex)
  - Use Lex/Polly within flows for bot-led segments
- If you truly require full-duplex third-party voice to customer, consider a different telephony anchor that supports SIP/WebRTC B2BUA bridging (e.g., Amazon Chime Voice Connector + SIP media app, Twilio programmable voice, or a custom SBC). This is a materially different architecture than standard CCP.

## Using CLI without CCP
- You can start calls via CLI or API; however, without CCP or a desk phone there’s no live agent talk-path into the call.
- CLI can trigger call flows, queue placement, or automated prompts, but it cannot substitute the agent’s live bidirectional audio stream.

## What we’ve implemented in the repo
- Assist-only topology using CCP + parallel Azure Realtime session (AzureSalesAgentPanel).
- CCP component (ConnectStreamsSoftphone) with user-gesture launch and a new-tab fallback; Approved Origins hint.
- Automatic Amazon Connect user provisioning from the CRM signup flow (same email/password) via ensureConnectUser.
- Integration Plan with detailed routing and constraints.

## Next steps if you want richer AI
- Wire Contact Lens real-time transcripts into the Azure assist panel to enhance suggestions with customer utterances.
- If you need occasional customer-audible AI, prepare short PlayPrompt clips generated on-demand (Polly/SSML) and trigger them from Contact Flow actions.
- Evaluate whether a SIP/WebRTC gateway (e.g., Chime Voice Connector + SIP media application) is justified if you want true full-duplex third-party voice injection.

## Operational reminders
- Associate an outbound phone number with the Connect queue to fix "Invalid outbound configuration".
- Add your app origin(s) to Connect > Application integration > Approved origins so the embedded CCP works.
