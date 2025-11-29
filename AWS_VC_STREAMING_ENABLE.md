# Enable Amazon Chime Voice Connector Streaming (us-west-2)

Goal
- Export live PSTN call audio from your Voice Connector (Ledger1VC) for real-time processing
- Preferred path: stream to Kinesis Video Streams (KVS) and consume from a Node/Lambda service
- If your account has bidirectional VC streaming enabled, we will inject audio back into the call via the same streaming session

Prerequisites
- AWS CLI configured with credentials that have Chime SDK Voice permissions
- Region: us-west-2

1) Identify your Voice Connector
```
aws chime-sdk-voice list-voice-connectors --region us-west-2
```
Note the `VoiceConnectorId` for Ledger1VC.

2) Configure streaming (baseline)
At minimum, turn streaming on and set data retention hours. Some accounts stream into Kinesis Video Streams (KVS) by default via console configuration.
```
aws chime-sdk-voice put-voice-connector-streaming-configuration \
  --region us-west-2 \
  --voice-connector-id <VOICE_CONNECTOR_ID> \
  --streaming-configuration '{"Disabled":false,"DataRetentionInHours":1}'
```
Validate:
```
aws chime-sdk-voice get-voice-connector-streaming-configuration \
  --region us-west-2 \
  --voice-connector-id <VOICE_CONNECTOR_ID>
```

3) Set up Kinesis Video Streams (if applicable)
If your Voice Connector is configured to stream into KVS (recommended managed path), ensure the associated KVS resources exist and you have IAM permissions to read the stream. In the AWS Console → Chime SDK → Voice Connector → Streaming, you may see KVS settings; configure as needed.

Consumer wiring (current repo)
- Upstream: aws/vc-streaming-consumer (MODE=kvs) will read KVS frames and forward to the Azure gateway.
- Downstream: until bidirectional VC streaming is available, responses can be played via SMA Speak/PlayAudio for simple prompts.

4) Bidirectional VC streaming (when enabled)
Some accounts can enable injection of audio back into the VC streaming session. If you have this feature, provide the session connection details (from the SMA/VC event or AWS API) so we can complete `VcBidiAdapter` to write frames back in real time.

Notes
- Streaming configuration options vary by account/setup. If `PutVoiceConnectorStreamingConfiguration` returns validation errors, use the AWS Console to enable streaming first, then re-run the CLI to verify.
- IAM: Ensure principals consuming KVS have permissions (e.g., `kinesisvideo:GetDataEndpoint`, `kinesisvideo:GetMedia`).
- Observability: monitor CloudWatch Logs for SMA and any consumer Lambdas/containers.

Next steps
- Provide your Ledger1VC `VoiceConnectorId` and confirm streaming status.
- If KVS streaming is active, share the stream ARN/name to wire the KVS adapter.
- If bidirectional streaming is available, share session connect info so we can implement downstream injection in the consumer.
