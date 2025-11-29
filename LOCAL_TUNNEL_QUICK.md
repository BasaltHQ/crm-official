Local webhook tunneling (you run these; I will not run your app)

If your app is on localhost:3000:
- npx localtunnel --port 3000

If your app is on a different port (for example Next switched to 3001):
- npx localtunnel --port 3001

Optional (custom subdomain, if available):
- npx localtunnel --port 3000 --subdomain mydevhook

ngrok alternative:
- ngrok http 3000

After it prints a public URL (for example https://abc123.loca.lt), share it so I can register the Azure OpenAI webhook to:
- https://abc123.loca.lt/api/azure/webhook

Notes
- Your local app must already be running; I will not start or stop it.
- OPENAI_WEBHOOK_SECRET is already set in nextcrm-app/.env.local as localdevsecret for signature verification.
- If you change ports or secrets, update your tunnel command and .env.local accordingly and restart your app yourself.
