# Voice Connector Streaming Consumer (bidirectional scaffold)

Purpose
- Consume Amazon Chime Voice Connector Streaming for a live PSTN call
- Forward upstream caller audio frames to the Azure Gateway over WebSocket
- Receive downstream AI audio frames from the Gateway and inject back into the same streaming session

Status
- Gateway side implemented: per-call session management, Azure Realtime WS bridge, audio conversions (mu-law/PCM16, resampling 8k/16k)
- Consumer scaffold added with adapters for:
  - KVS adapter (upstream reading only; downstream injection via SMA fallback TBD)
  - VC Bidirectional adapter (placeholder; to be implemented once bidirectional streaming is enabled on your VC)

Repo structure
- aws/azure-gateway/server.ts — Gateway bridge and Azure Realtime session manager
- aws/vc-streaming-consumer/src/index.ts — Consumer entry with adapters and WS bridge to gateway
- aws/vc-streaming-consumer/.env.example — Env config for the consumer

Prerequisites
- Node.js 18+
- AWS CLI configured for us-west-2 with access to Amazon Chime SDK Voice
- Your Gateway deployed and reachable (health endpoint returns ok: true)

Install & build
```
cd nextcrm-app/aws/vc-streaming-consumer
npm install
npm run build
```

Run (local)
1) Copy .env.example to .env and set:
   - GATEWAY_URL (e.g., wss://ledger1-gateway.../ingest)
   - GATEWAY_SECRET
   - CALL_ID (from SMA/VC event if available; otherwise a UUID for testing)
   - MODE=bidi (for bidirectional VC streaming) or kvs (Kinesis test path)
2) Start:
```
npm run start
```
This will connect to the gateway and begin forwarding upstream audio frames (when adapter is wired to VC streaming). Downstream frames from the gateway will be written back to the adapter for injection.

Enabling Voice Connector Streaming (us-west-2)
1) Find your Voice Connector ID:
```
aws chime-sdk-voice list-voice-connectors --region us-west-2
```
Look for the `VoiceConnectorId` for Ledger1VC.

2) Enable streaming configuration (placeholder example; update as required by your AWS account):
```
aws chime-sdk-voice put-voice-connector-streaming-configuration \
  --region us-west-2 \
  --voice-connector-id <VOICE_CONNECTOR_ID> \
  --streaming-configuration '{"Disabled":false,"DataRetentionInHours":1}'
```
Note: Some accounts use Kinesis Video Streams as the media target. If so, configure the VC to stream to KVS via the console, then implement the KVS adapter to read frames. Bidirectional injection requires VC bidirectional streaming feature on your account. If you do not see the bidirectional option, we will use KVS + SMA Speak/PlayAudio as a fallback for downstream.

Adapter wiring (to be implemented next)
- VC Bidirectional adapter: connect to the live VC streaming session using session details from SMA/VC; emit inbound audio frames to `GatewayBridge.sendUpstreamAudioFrame`; accept downstream audio frames via `GatewayBridge.onDownstreamAudio` and inject back into the session.
- KVS adapter: use Kinesis Video Streams GetMedia to read MKV audio frames (PCM/mu-law) and forward to gateway. For downstream, use SMA Speak/PlayAudio until VC bidirectional is enabled.

Audio formats
- VC side: default mu-law 8 kHz
- Azure side: PCM16 16 kHz
- Gateway will convert upstream mu-law → PCM16 16 kHz for Azure, and convert downstream PCM16 16 kHz → mu-law 8 kHz for VC injection.

Troubleshooting
- Ensure gateway health is green (`GET /health`).
- Confirm `x-gateway-secret` matches the gateway's `GATEWAY_SHARED_SECRET`.
- If Azure messages differ, adjust `server.ts` handlers for Azure Realtime event schema.
- When testing locally without live VC streaming, you can simulate upstream by sending small audio buffers from a file to the gateway; the downstream path will log a write attempt in the adapter.

Next steps
- Implement VC bidirectional adapter using the Voice Connector Streaming APIs/session details.
- Add basic metrics (per-call session lifecycle, frame rates, drop counts).
- Validate with a live outbound call (SMA keep-alive) and confirm caller hears AI output.
