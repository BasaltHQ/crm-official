Azure Container App deployment plan for azure-realtime-gateway

Resources
- Resource Group: ledger1-rt-gw (eastus2)
- Azure Container Registry: ledger1acr (eastus2)
- Container Apps Environment: ledger1-gw-env (eastus2)
- Container App: ledger1-gateway

Image
- ledger1acr.azurecr.io/azure-realtime-gateway:latest

Env Vars
- PORT=8080
- LOG_LEVEL=info
- AZURE_OPENAI_REALTIME_WS_URL=wss://eastus2.realtimeapi-preview.ai.azure.com/v1/realtime
- AZURE_OPENAI_REALTIME_API_VERSION=2025-04-01-preview
- AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-realtime
- AUDIO_ENCODING=mulaw
- SAMPLE_RATE=8000
- Secrets: AZURE_OPENAI_API_KEY, GATEWAY_SHARED_SECRET

Post-deploy
- Retrieve FQDN: az containerapp show -n ledger1-gateway -g ledger1-rt-gw --query properties.configuration.ingress.fqdn -o tsv
- Health check: https://<FQDN>/health
- WebSocket ingest: wss://<FQDN>/ingest?callId=<id> with header x-gateway-secret
