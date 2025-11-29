Local Azure OpenAI Webhook – localhost:3000 setup (no auto-running)

Goal
- Use your locally running Next.js app as the webhook listener at http://localhost:3000/api/azure/webhook without me starting or stopping anything for you.

What’s already in place
- Webhook endpoint implemented at: app/api/azure/webhook/route.ts
  - Verifies Webhook-Signature with OPENAI_WEBHOOK_SECRET
  - Uses Webhook-ID for idempotency (in-memory)
  - Fast-ack with async hook for heavy work
- .env.local now includes:
  - OPENAI_WEBHOOK_SECRET=localdevsecret

Important: Your app must be running already
- If your Next.js dev server is already running on 3000, great — proceed.
- If it’s running on another port (e.g., 3001), either:
  - Keep using that port and expose it instead (replace 3000 with your port in the commands below), or
  - Restart your app yourself with PORT=3000 to use localhost:3000 (do not ask me to run it; I won’t).

Expose localhost:3000 to the internet (pick one)
1) Localtunnel (simple)
   - In a terminal you control (not me), from any folder:
     npx localtunnel --port 3000
   - It will print a URL like: https://<random>.loca.lt

2) ngrok (if you prefer)
   - ngrok http 3000
   - Use the https URL it prints.

Register the webhook endpoint (Azure OpenAI)
- Use our helper script to create/list/delete webhook endpoints via REST.
- You run this yourself (replace values):

  powershell -NoProfile -File "u:\TUCCRM\nextcrm-app\scripts\register-azure-webhook.ps1" ^
    -EndpointBase "https://skyne-m9q617jz-swedencentral.cognitiveservices.azure.com" ^
    -ApiKey "<AZURE_OPENAI_API_KEY>" ^
    -WebhookUrl "https://<your-public>/api/azure/webhook" ^
    -EventTypes @('response.completed','realtime.call.incoming') ^
    -Action create

- Note: The signing_secret is only shown once on creation. Save it in a safe place (Key Vault, secrets, etc.). For local dev you can keep using OPENAI_WEBHOOK_SECRET=localdevsecret if you test with background=True flows that validate signatures accordingly.

Quick sanity checks (you run these)
- Does your local endpoint respond at all?
  curl -i http://localhost:3000/api/azure/webhook -X POST -H "Content-Type: application/json" -d "{}"
  Expect 400 (Invalid signature) from our handler. That’s good — it means the route is wired and signature is enforced.

- After registering with Azure and triggering an event (for example with responses API using background=True), you should see logs like:
  [webhook] event { type: 'response.completed', id: '...' }

Common adjustments
- If your dev server uses another port, replace 3000 with that port in:
  - localtunnel/ngrok commands
  - curl tests
  - WebhookUrl passed to register-azure-webhook.ps1

- If you want a different local secret:
  - Update OPENAI_WEBHOOK_SECRET in nextcrm-app/.env.local and restart your dev server yourself.

What I will not do (per your request)
- I will not start, stop, or restart your local Next.js app.
- I will not start tunnels automatically. The commands above are for you to run.

Next steps
- Run a tunnel and share the public URL if you want me to register the webhook for you (or run the PowerShell command yourself).
- Once Azure starts hitting your local endpoint, we can validate end-to-end, then proceed to wire this into the voice flow.
