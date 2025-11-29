# Gateway /ingest WebSocket debug notes

Observed behavior
- Tone sender connects to gateway and then the WS closes immediately with code 1005 (no reason)
- This rules out the explicit 1008/"unauthorized" close we coded for secret mismatch
- Health endpoint responds ok

Likely causes
- Azure Realtime upstream session failing to initialize (API key/endpoint/deployment), and the container environment or app ingress tears down client sockets quickly
- Container App ingress policy closing the socket due to upstream error or missing expected protocol sequence
- Crash/exception in the gateway container during early message handling

Immediate next checks
1) Container logs (Azure Container Apps)
   Resource: RG=ledger1-rt-gw; App=ledger1-gateway
   - Use Portal: Container Apps → ledger1-gateway → Logs → Live logs
   - Filter for entries around client connect time; look for
     - "consumer connected" line with enc/sr
     - Azure Realtime connect success/failure
     - Any thrown errors in ws.on('message') / sendAudioChunkToAzure

2) Confirm env at runtime
   In the Container App, check Environment variables (we previously queried via az rest):
   - AZURE_OPENAI_REALTIME_WS_URL=wss://eastus2.realtimeapi-preview.ai.azure.com/v1/realtime
   - AZURE_OPENAI_REALTIME_API_VERSION=2025-04-01-preview
   - AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-realtime
   - AZURE_OPENAI_API_KEY (secretRef: azure-openai-api-key)
   - GATEWAY_SHARED_SECRET (secretRef: gateway-shared-secret)
   If any differ from intended or the secret value is invalid/expired, fix and restart revision.

3) Verify outbound egress
   Ensure the container has outbound access to Azure Realtime endpoint (no VNet egress block, NACL, or DNS issue). Try a simple curl/wget from a sidecar or use Diagnostics → Networking.

4) Increase diagnostics (optional quick patch)
   - Add server-side ws close listener to log close code/reason on the server for /ingest clients.
   - Log Azure WS open/error/close reasons.

5) Retest with verbose client
   We updated src/test-sine.ts to log the WS close code/reason; keep it running for 60s to observe behavior. If it still closes with 1005, it strongly suggests server-side closure or upstream failure.

If logs show Azure Realtime failure
- Verify the API key and model deployment
- Try a simpler session.update payload (only input/output formats)
- If the endpoint requires specific headers or schema changes, adjust gateway accordingly

Next steps in repo (once WS stays open)
- Implement VcBidiAdapter (aws/vc-streaming-consumer/src/index.ts) to attach to VC streaming session and forward real upstream audio
- Place a PSTN test call (echo 6001) to validate upstream/downstream audio path

Commands (reference)
- Tone test (cmd.exe):
  cd /D nextcrm-app\aws\vc-streaming-consumer && set GATEWAY_URL=wss://<fqdn>/ingest& set GATEWAY_SECRET=<secret>& set CALL_ID=test-bridge& npx ts-node src\test-sine.ts
- Tone test (PowerShell):
  $env:GATEWAY_URL='wss://<fqdn>/ingest'; $env:GATEWAY_SECRET='<secret>'; $env:CALL_ID='test-bridge'; Set-Location 'nextcrm-app/aws/vc-streaming-consumer'; npx ts-node src/test-sine.ts

Container App (via REST if extension not available)
- List app by FQDN (api-version may vary):
  az rest --method get --url "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.App/containerApps/<name>?api-version=2025-01-01" --query "{fqdn:properties.configuration.ingress.fqdn, env:properties.template.containers[0].env}"

Outcome
- Once we capture server-side logs around the moment of closure, we can correct configuration or error handling in the gateway and proceed to full VC streaming integration.
