# Server-only WebSocket audio bridge plan (Voice Connector Streaming ↔ Gateway ↔ Azure Realtime)

Goal: Remove browser WebRTC capture from the Leads Workspace and complete an end-to-end, server-only audio path:

Amazon Chime Voice Connector Streaming → Node Consumer (bidirectional) → WebSocket Gateway (/ingest) → Azure OpenAI Realtime (WS) → Gateway → back to caller via the same VC streaming session.

Why: Browser/WebRTC leg (Chime meeting) is not mixing with the PSTN leg, causing silence. A server-only bridge avoids NAT/device issues and uses supported VC streaming APIs.

Architecture components
- VC Streaming Consumer (Node):
  - Connects to Voice Connector bidirectional streaming session for each call.
  - Forwards upstream frames (mu-law 8kHz) to the Gateway via WS (/ingest?callId=...).
  - Listens for downstream frames from the Gateway; injects them into the VC stream so caller hears AI.
  - Manages lifecycle (start/stop per call), reconnection, heartbeats, and backpressure.
- Gateway (Azure Realtime bridge):
  - Maintains per-call Azure Realtime WS session.
  - Converts VC audio (mu-law 8kHz) to Azure PCM16 16kHz; base64 wraps per Azure event schema.
  - Receives Azure PCM16; resamples/encodes back to VC downstream format (mu-law 8kHz) and broadcasts frames to connected consumers.
  - Auth via shared-secret; origin checks; heartbeats.
- Leads Workspace UI:
  - Remove WebRTC bridge creation (Chime meeting). Only show health status and call controls.
  - Call initiation invokes SMA outbound only; no meetingId.

Implementation steps
1) AWS VC Streaming enablement and events
   - Confirm/enable bidirectional streaming on Ledger1VC (us-west-2).
   - Configure EventBridge → SQS for VC streaming session events to obtain per-call session identifiers.

2) VC streaming consumer (Node)
   - Complete VcBidiAdapter in `aws/vc-streaming-consumer/src/index.ts`:
     - Connect to bidirectional media stream using call/session details (from SQS/EventBridge or SMA context).
     - Emit upstream audio frames to Gateway via WS.
     - Inject downstream frames back into the stream.
   - Implement lifecycle hooks and backpressure.

3) Gateway server
   - `aws/azure-gateway/server.ts` is largely ready:
     - Verifies shared-secret, supports /ingest, resamples/encodes (mu-law↔PCM16) and maintains Azure WS.
   - Add small control messages, logging, and metrics.

4) Leads Workspace
   - Update `ChimeBridgePanel.tsx` to stop creating a browser Chime meeting. Keep health status + outbound call button.
   - `/api/outreach/call/initiate` stays as SMA outbound; remove meeting headers in `/api/voice/chime/outbound` if present.

5) Observability
   - Add per-call logs and counters (frame rates, drops, response latency) in both consumer and gateway.
   - Health endpoints already exist in the gateway.

6) Validation
   - Test with an outbound call to echo (6001) via streaming to ensure downstream injection path works.
   - Switch to AI: verify caller hears Azure Realtime responses.
   - Optionally test conference (6000) if mixer is retained for troubleshooting.

7) Fallback
   - If Azure session fails, continue SMA keep-alive prompts (Speak/Pause) and gracefully hang up or retry.

Notes
- Telephony defaults: mu-law 8kHz upstream/downstream on VC side; Azure prefers PCM16 16kHz.
- Ensure RTP/NAT settings on any mixer (if retained) but the server-only bridge should bypass mixer entirely.
- Keep secrets in container app settings; never expose gateway secret in browser.
