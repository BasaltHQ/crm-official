Amazon Connect Streams SDK (connect-streams.js)

Your environment cannot resolve the AWS CDN domains for the Streams SDK (net::ERR_NAME_NOT_RESOLVED). To ensure the softphone loads, vendor the SDK locally and/or set an override URL.

Option A: Vendor locally (recommended for restricted networks)
1) Create this file next to this README:
   nextcrm-app/public/connect/connect-streams.js
2) Download the official SDK and save its contents into the file above. Sources (pick ONE that works in your network):
   - https://cdn.connect.aws/connect-streams.js
   - https://cdn.connect.amazon.com/connect-streams.js
   - If both are blocked, request your network/security team to provide an internal mirror, then place it here.
3) Ensure the file is accessible at runtime: http://localhost:3000/connect/connect-streams.js
4) Optional but recommended: set NEXT_PUBLIC_CONNECT_STREAMS_URL in .env.local to point at the local path
   NEXT_PUBLIC_CONNECT_STREAMS_URL=/connect/connect-streams.js

Option B: Use an override CDN
1) Add to .env.local (choose a CDN your network allows):
   NEXT_PUBLIC_CONNECT_STREAMS_URL=https://<your-approved-cdn>/connect-streams.js
2) Restart the dev server so the client picks up the env change.

Notes
- The ConnectStreamsSoftphone component attempts these URLs in order:
  - /connect/connect-streams.js (local, preferred for container-only)
  - NEXT_PUBLIC_CONNECT_STREAMS_URL (if set)
  - https://cdn.connect.aws/connect-streams.js
  - https://cdn.connect.amazon.com/connect-streams.js
- After the SDK loads, it initializes CCP with loginPopup. You should see a login window and then the softphone.
- If you continue to see loader errors, verify that the script URL resolves in your browser (open it directly) and that your app can serve /connect/connect-streams.js.

Troubleshooting
- If you see CSP errors later when the softphone tries to load: ensure your site allows the popup and microphone permissions. The Streams SDK approach avoids frame-ancestors CSP issues by using a popup, not an iframe.
- If you need help collecting the official SDK contents and hashing them, contact your network/security admin to mirror the file.

How to obtain an internal mirror or local copy
- From any workstation that can reach AWS CDNs:
  - Windows PowerShell:
    Invoke-WebRequest -Uri https://cdn.connect.aws/connect-streams.js -OutFile .\nextcrm-app\public\connect\connect-streams.js
  - macOS/Linux:
    curl -L https://cdn.connect.aws/connect-streams.js -o nextcrm-app/public/connect/connect-streams.js
- If those hosts are blocked, ask IT to host an internal mirror (e.g., https://mirror.company.local/connect-streams.js) and then run:
  - Windows:
    set CONNECT_STREAMS_SOURCE_URL=https://mirror.company.local/connect-streams.js
    node nextcrm-app\scripts\fetch-connect-streams.mjs
  - macOS/Linux:
    CONNECT_STREAMS_SOURCE_URL=https://mirror.company.local/connect-streams.js \
      node nextcrm-app/scripts/fetch-connect-streams.mjs
- To bake into the container image, add to Dockerfile:
  COPY public/connect/connect-streams.js /app/public/connect/connect-streams.js

AWS-side clarification
- No Amazon-side change is required for the Streams SDK file itself; it’s a client-side script served to your browser. Your Amazon Connect storage/KMS/CloudWatch configuration (recordings, transcripts, reports, logs) is separate and already looks correctly configured from your notes.
