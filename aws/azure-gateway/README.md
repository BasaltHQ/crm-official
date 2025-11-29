# Chime → Azure OpenAI Realtime Gateway (Managed path, no local SIP mixer)

Goal
- Keep Amazon Chime for inbound/outbound PSTN (SMA + Voice Connector)
- Use a small, stateless gateway to bridge Voice Connector audio to Azure OpenAI Realtime (WebRTC/WS) and play AI audio back to the caller
- Keep the SMA Lambda simple (greet/keep-alive) so calls no longer disconnect while the gateway handles AI

Why a gateway is required
- SIP/RTP (what SMA/Voice Connector speak) and WebRTC (what Azure Realtime terminates) are different protocols. A glue service must: (1) receive PSTN audio, (2) push audio frames to Azure Realtime, (3) receive AI audio/tts and inject it back to the call.
- Bridging an SMA leg back to the Voice Connector hostname loops the route and triggers action validation problems. That’s why you saw CallAndBridge errors and hangups.

Architecture (recommended)
1) Call path: PSTN ↔ Voice Connector ↔ SIP Media App (SMA) Lambda (keep-alive only)
2) Media path: Voice Connector Streaming → Gateway (WebSocket) → Azure OpenAI Realtime (WebRTC/WS)
3) Return audio: Azure → Gateway → Voice Connector Streaming (bidirectional), so the caller hears the AI

What I will add here
- server.ts: Minimal Node.js gateway that
  - Accepts Voice Connector Streaming frames (PCM/mu-law) via WebSocket (HTTP upgrade)
  - Dials Azure Realtime (WebRTC signaling over WebSocket), sends caller audio, receives AI audio
  - Writes AI audio back into the Voice Connector stream
- .env.example: Azure and gateway secrets

Enabling Voice Connector Streaming (at a high level)
- In AWS Console → Chime SDK → Voice Connectors → your VC (Ledger1VC)
  - Enable Streaming (bidirectional) and set target to your gateway’s wss:// endpoint
  - Optionally enable EventBridge notifications for lifecycle events

Notes
- If you prefer Kinesis Video Streams (KVS) instead of direct WS: VC can stream into KVS; a Lambda/Node consumer forwards frames to Azure Realtime and uses SMA Speak/PlayAudio for responses. The WS path reduces latency and components.

Next steps
1) Confirm: direct WebSocket gateway (simpler, lower latency) or Kinesis Video Streams (managed stream + consumer)
2) I will generate:
   - aws/azure-gateway/server.ts (gateway scaffold)
   - aws/azure-gateway/.env.example
3) I’ll provide the exact AWS CLI or console steps to enable VC streaming to the gateway URL you deploy (EC2/Container App/Render/Cloud Run/Vercel Functions with WS support).

After deployment
- Place an outbound call (already working). SMA will keep the call up, Voice Connector will stream media to the gateway, and the gateway will connect to Azure Realtime to produce AI guidance/voice in loop.
