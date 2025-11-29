# Chime (SMA/Voice Connector) → Azure OpenAI Realtime Gateway Plan

Why we can’t “just bridge managed SIP to Azure WebRTC” directly:
- SIP/RTP and WebRTC are different signaling and media transports. Amazon Chime SIP Media Application and Voice Connector handle SIP/PSTN. Azure OpenAI Realtime terminates WebRTC or its own WS/JSON protocol. You need a small gateway that terminates the SIP side’s media stream and forwards the audio to Azure Realtime, then relays AI audio back to the call.
- Trying to CallAndBridge the SMA leg to the Voice Connector hostname loops the call into the same trunk and fails action validation. That’s why we saw immediate disconnects.

The minimal, managed path on AWS:
1) Use Amazon Chime Voice Connector Streaming (managed) to export bidirectional audio from the call. This is an AWS feature intended for real‑time processing.
2) Stand up a small gateway service that:
   - Receives VC streaming audio (PCM/mu‑law packets) and converts to the Azure Realtime media format over WebRTC/WS.
   - Receives Azure Realtime audio responses and writes them back to the VC stream in real time.
3) Keep SMA Lambda simple (greet + keep‑alive) so the call stays up while the gateway runs the AI.

What I’ll implement next (scaffold):
- A Node.js gateway service (ws/http) you can run on EC2/Container App/Render/Heroku. It will:
  - Terminate VC streaming (WebSocket) and parse media frames.
  - Initiate Azure Realtime session (WebRTC via WS signaling) and push audio frames from caller → Azure; pull AI audio back → VC.
  - Provide a simple health endpoint and logs.
- CLI steps to enable VC streaming and point it at the gateway.

Files added next (scaffold to be committed):
- nextcrm-app/aws/azure-gateway/server.ts – minimal WebSocket server and Azure Realtime client wiring
- nextcrm-app/aws/azure-gateway/.env.example – AZURE_OPENAI_* and shared secret
- nextcrm-app/aws/azure-gateway/README.md – run and deploy instructions

Once this is deployed, we’ll:
- Enable Voice Connector Streaming (aws chime-sdk-voice put-voice-connector-streaming-configuration) with bidirectional audio and set the correct target type (WebSocket) or Kinesis Video Streams if you prefer the KVS path with a Lambda consumer.
- Test a call: SMA greets/keeps alive; VC streams audio → gateway → Azure; AI responses flow back and are injected to the call.

Alternative (Kinesis path):
- Configure VC to stream into Kinesis Video Streams.
- Create a consumer (Node/Lambda) to read frames, forward to Azure Realtime, and send TTS back via SMA Speak/PlayAudio.

Please confirm you prefer the direct WebSocket gateway or Kinesis route. I’ll then generate and commit the server scaffold and the exact AWS CLI to enable VC streaming against your Voice Connector (hc8xljgddzsgdqqvodadso).
