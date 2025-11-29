# Amazon Connect CCP Setup for Ledger1CRM

This guide documents how to configure and use the Amazon Connect Streams SDK (CCP) with Ledger1CRM. It covers Approved Origins, environment variables, queue/contact flow IDs, and integration details for outbound dialing.

## 1) Prerequisites

- An Amazon Connect instance (e.g. `https://your-instance.my.connect.aws`)
- An agent user able to log in to the CCP
- A queue and contact flow that allow outbound calling (IDs below)
- Your Ledger1CRM site origin (e.g. `https://crm.company.com` or `http://localhost:3000`)

## 2) Approved Origins (CSP for CCP)

The CCP enforces CSP via `frame-ancestors` and allows embedding only for Approved Origins.

- In the Amazon Connect Admin Console:
  - Go to: Instance > Application integration > Approved origins
  - Add your Ledger1CRM origin:
    - `http://localhost:3000` (local dev)
    - `https://crm.company.com` (production)
- If you use inline CCP (`preferPopup=false`), Approved Origins must include your site. The default configuration uses `preferPopup=true`, which avoids frame-ancestors issues by opening CCP in a popup window.

Docs: https://docs.aws.amazon.com/connect/latest/adminguide/approved-origins.html

## 3) Environment Variables

Add these variables in `nextcrm-app/.env.local`:

```
# Amazon Connect base URL (instance URL)
NEXT_PUBLIC_CONNECT_BASE_URL=https://your-instance.my.connect.aws

# Optional: override Streams SDK URL if CDN is blocked (or use the local vendored file)
# e.g., /connect/connect-streams.js or an internal mirror
NEXT_PUBLIC_CONNECT_STREAMS_URL=/connect/connect-streams.js

# Region used by Streams initialization (defaults to us-west-2 if unset)
AWS_REGION=us-west-2

# Optional: Amazon Connect resources for outbound calls
# See below for how to get these IDs
CONNECT_QUEUE_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
CONNECT_CONTACT_FLOW_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
```

Notes:
- If your network cannot resolve AWS CDNs for the Streams SDK, vendor the SDK locally (see `nextcrm-app/public/connect/README.md`).
- CCP popup login is enabled by default (`preferPopup=true`) in `ConnectStreamsSoftphone`, which prevents frame-ancestors CSP errors.

## 4) Getting Queue and Contact Flow IDs

From the Amazon Connect Admin, or via AWS CLI:

- Queue ID:
  - Admin Console: Routing > Queues > select queue > details show the ID
  - AWS CLI: `aws connect list-queues --instance-id <instance-id>` (filter for outbound queue)
- Contact Flow ID:
  - Admin Console: Routing > Contact flows > select contact flow > details show the ID
  - AWS CLI: `aws connect list-contact-flows --instance-id <instance-id>`

Paste those IDs into `.env.local` as `CONNECT_QUEUE_ID` and `CONNECT_CONTACT_FLOW_ID`.

## 5) Streams SDK Provisioning (connect-streams.js)

The component attempts to load the SDK in this order:

1. Local vendor: `/connect/connect-streams.js`
2. Env override: `NEXT_PUBLIC_CONNECT_STREAMS_URL`
3. AWS CDN: `https://cdn.connect.aws/connect-streams.js`
4. AWS CDN: `https://cdn.connect.amazon.com/connect-streams.js`

If your network blocks AWS CDNs, vendor the SDK locally:
- See `nextcrm-app/public/connect/README.md` for instructions
- Ensure the file is served at `http://localhost:3000/connect/connect-streams.js`

## 6) How Ledger1CRM Uses CCP

- The Dialer uses `ConnectStreamsSoftphone` and controls the CCP via `postMessage` bridge:
  - `softphone:setNumber` (set E.164 number)
  - `softphone:dial` (create outbound contact)
  - `softphone:hangup` (end contact)

- E.164 format is required: `+15551234567`
- Ledger1CRM never uses Chime SDK paths for dialing; CCP-only dialing is enforced.

Files:
- `nextcrm-app/components/voice/ConnectStreamsSoftphone.tsx` (Streams + CCP integration)
- `nextcrm-app/app/[locale]/(routes)/crm/dialer/DialerPanel.tsx` (Dialer UI, CCP postMessage commands)
- `nextcrm-app/app/[locale]/(routes)/crm/prompt/PromptGeneratorPanel.tsx` (Prompt + CCP panel)

## 7) Popup vs Inline

- Default: popup login (`preferPopup=true`), which avoids frame-ancestors CSP.
- Inline mode (`preferPopup=false`) is available, but you must:
  - Add Ledger1CRM origin to Approved Origins
  - Allow microphone permissions in the browser
  - Expect stricter CSP behavior from CCP iframe

## 8) Troubleshooting

- CSP or frame-ancestors error:
  - Use popup mode (default)
  - Or add your site origin to Approved Origins and use inline mode

- SDK fails to load (ERR_NAME_NOT_RESOLVED):
  - Vendor `connect-streams.js` locally
  - Or set `NEXT_PUBLIC_CONNECT_STREAMS_URL` to an approved internal mirror

- Dial fails:
  - Verify E.164 number format
  - Ensure `CONNECT_QUEUE_ID` and `CONNECT_CONTACT_FLOW_ID` are correct and allow outbound dialing
  - Confirm agent is logged in and CCP displays the softphone after popup login

## 9) Prompt Injection to VoiceHub (context)

- Ledger1CRM can push System Prompts per wallet to VoiceHub:
  - CRM endpoint: `POST /api/crm/prompt/push` (forwards to VoiceHub if configured)
  - VoiceHub endpoints:
    - `POST /api/crm/prompt/push` (store per-wallet latest prompt)
    - `GET /api/crm/prompt/pull` (retrieve latest prompt per wallet)
- VoiceHub Console auto-pulls and applies System Prompt:
  - On session start and when clicking “Apply Settings”

This completes the CCP setup needed to run outbound dialing from Ledger1CRM using Amazon Connect Streams SDK.
