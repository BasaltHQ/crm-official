# Can AWS Connect CLI replace CCP for Azure OpenAI Realtime WebRTC? (Media Path Limitations)

You can place and control calls via AWS Connect CLI/API (StartOutboundVoiceContact) without opening the CCP UI, but Amazon Connect does not expose a WebRTC media endpoint that accepts arbitrary third‑party audio to inject into the live telephony call. Live bidirectional agent audio must come from:
- The agent’s CCP (Streams softphone) WebRTC session, or
- A desk phone/SIP device registered to the agent

The CLI/API can start calls, set attributes, route to queues, and drive Contact Flows—but it can’t substitute the agent media stream with your own WebRTC source (e.g., Azure OpenAI Realtime). That’s why we implemented the assist‑only topology: CCP for call media; a parallel WebRTC session to Azure for real‑time suggestions and optional whisper‑to‑agent TTS.

## What the CLI/API can do today

### 1) Place an outbound call (no CCP UI needed)
```powershell
# Set region
aws configure set region us-west-2

# Vars
$IID = "a5c19f0e-0507-4d76-a90b-0f427e5a925b"              # CONNECT_INSTANCE_ID
$FLOWID = "8ceefad0-4410-4a68-b714-ed3f74d0eb63"          # CONNECT_CONTACT_FLOW_ID (OUTBOUND)
$QUEUEID = "e65624f8-f0d3-4b58-86e3-b0e712421928"         # CONNECT_QUEUE_ID (optional)
$DEST = "+1XXXXXXXXXX"                                    # E.164 phone

# Start the call
$CID = (aws connect start-outbound-voice-contact \
  --instance-id $IID \
  --contact-flow-id $FLOWID \
  --destination-phone-number $DEST \
  --queue-id $QUEUEID \
  --output json | ConvertFrom-Json).ContactId

# Describe status
aws connect describe-contact --instance-id $IID --contact-id $CID --output json

# Stop if needed
aws connect stop-contact --instance-id $IID --contact-id $CID
```

### 2) Fix "Invalid outbound configuration" by associating a phone number with the queue
```powershell
# Find your claimed phone numbers
aws connect list-phone-numbers --instance-id $IID --output json

# Associate a number with your queue (replace <NumberId>)
aws connect update-phone-number \
  --phone-number-id <NumberId> \
  --target-arn arn:aws:connect:us-west-2:867344432514:instance/$IID/queue/$QUEUEID
```

### 3) Stream customer audio for analysis (server‑side) via Customer Voice Stream
If your use case is analysis/coaching—not direct audio injection—you can stream contact audio to Kinesis Video Streams and process it in near real‑time.
```powershell
# Start contact streaming (example; replace Kinesis Stream ARN and media type)
aws connect start-contact-streaming \
  --instance-id $IID \
  --contact-id $CID \
  --chat-streaming-config '{"StreamingEndpointArn":"arn:aws:kinesisvideo:us-west-2:ACCOUNT:stream/your-connect-stream/.."}' \
  --media-stream-type CUSTOMER

# Later stop
aws connect stop-contact-streaming --instance-id $IID --contact-id $CID --media-stream-type CUSTOMER
```
Note: API shapes differ by region and Connect features; consult your instance’s supported streaming configuration (Customer Voice Stream vs Chat). Many implementations use Contact Lens for real‑time transcripts instead of raw audio frames.

## How to get AI audio to the customer
Full‑duplex arbitrary third‑party voice back into the live Connect call is not supported. Practical options:
- PlayPrompt clips in the Contact Flow (Polly/SSML) for short system utterances.
- Use Amazon Lex bot segments inside flows.
- Whisper to agent in the browser (parallel Azure Realtime session) for coaching.

If you truly need full‑duplex AI voice injection, consider a different telephony anchor that supports SIP/WebRTC application bridging (e.g., Amazon Chime Voice Connector + SIP media application, or a programmable voice provider), and route PSTN through that gateway. That is a different architecture than standard CCP.

## What we implemented in the repo
- Assist‑only topology: CCP handles live call media; AzureSalesAgentPanel runs parallel WebRTC to Azure for suggestions/whisper.
- CCP component ConnectStreamsSoftphone with user‑gesture launch and new‑tab fallback; Approved Origins hint.
- Automatic Connect user provisioning from CRM signup (same email/password) via ensureConnectUser.
- Integration Plan and Bridge Notes documenting constraints and next‑step options.

## Recommended next steps
- Associate an outbound number with your queue (fixes outbound error).
- Add your app origin to Connect > Application integration > Approved origins (for embedded CCP).
- Wire Contact Lens real‑time transcript into Azure assist prompt context for richer suggestions.
- If occasional customer‑audible AI is required, pre‑generate short PlayPrompt clips and trigger them from flows.
