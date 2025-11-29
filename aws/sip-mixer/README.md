# SIP Mixer (Asterisk) for PSTN ↔ Azure Agent two-way audio

This lightweight mixer lets the SIP Media Application (SMA) CallAndBridge your PSTN leg into a simple conference room that your browser-side audio (Azure agent via Chime bridge) can also feed into. With this in place, your PSTN caller will hear and be heard by the agent.

We’ll start with a simple Asterisk-in-Docker setup that exposes SIP and RTP. You can later harden it (TLS/SRTP, auth, ACL) and/or move it to a cloud VM with a public IP.

## Overview
- SMA will CallAndBridge to a SIP URI/E.164 that lands in a conference (e.g., room 6000) on this mixer.
- Your browser-side app (ChimeBridgePanel) continues to start a Chime meeting and inject your Azure agent audio to the meeting.
- To actually mix PSTN with the browser audio, point the mixer to a second leg you control (e.g., a WebRTC leg to the browser or a softphone) OR extend the app to dial the mixer as a SIP WebRTC client. As an interim, this setup lets us validate end-to-end SIP bridging from SMA and keeps the call up (no idle hangup).

Note: The most robust path is to use a dedicated SIP/WebRTC mixer (Asterisk/FreeSWITCH) and have both:
- SMA → mixer conference (PSTN leg)
- Browser (or a small headless bot) → mixer conference (WebRTC/SIP leg)
This way media truly mixes server-side.

## Files to create
Create these files under `nextcrm-app/aws/sip-mixer/`:

1) `docker-compose.yml`
```
version: '3.8'
services:
  asterisk:
    image: andrius/asterisk:20
    container_name: sip-mixer
    restart: unless-stopped
    network_mode: host  # For simplicity; alternatively map ports below
    volumes:
      - ./asterisk/etc:/etc/asterisk
      - ./asterisk/var:/var/lib/asterisk
      - ./asterisk/log:/var/log/asterisk
    # If you prefer mapped ports instead of host network, comment network_mode and uncomment:
    # ports:
    #   - "5060:5060/udp"
    #   - "5060:5060/tcp"
    #   - "8088:8088/tcp"   # HTTP/WebSocket if using SIP over WS later
    #   - "10000-20000:10000-20000/udp"  # RTP
```

2) `asterisk/etc/pjsip.conf`
```
[global]
; basic global opts

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

; Allow anonymous inbound from SMA (restrict by IPs in production)
[anonymous]
type=endpoint
context=public
disallow=all
allow=ulaw,alaw,opus
allow_subscribe=no
auth=anonymous-auth

[anonymous-auth]
type=auth
auth_type=anonymous

[anonymous-aor]
type=aor
max_contacts=1

[anonymous-ident]
type=identify
endpoint=anonymous
match=0.0.0.0/0
```

3) `asterisk/etc/extensions.conf`
```
[general]
static=yes
writeprotect=no
clearglobalvars=no

[public]
exten => 6000,1,NoOp(Join conference 6000)
 same => n,ConfBridge(6000)
 same => n,Hangup()

; A dialable test echo
exten => 6001,1,Answer()
 same => n,Playback(demo-echotest)
 same => n,Echo()
 same => n,Hangup()
```

4) `asterisk/etc/confbridge.conf`
```
[general]

[default_bridge]

[default_user]

[6000]
type=bridge
max_members=50

[6000_user]
; default user profile
```

5) `asterisk/etc/rtp.conf`
```
[general]
rtpstart=10000
rtpend=20000
```

6) (Optional) `asterisk/etc/http.conf` if you later want WebSocket/WebRTC
```
[general]
enable=yes
bindaddr=0.0.0.0
bindport=8088
```

## Run the mixer (local test)
On the host (Windows PowerShell):

```
# From repo root
mkdir -Force nextcrm-app\aws\sip-mixer\asterisk\etc
mkdir -Force nextcrm-app\aws\sip-mixer\asterisk\var
mkdir -Force nextcrm-app\aws\sip-mixer\asterisk\log
# Place the configs as above, then:
cd nextcrm-app\aws\sip-mixer
# If Docker Desktop is installed and running:
docker compose up -d
```

If you used `network_mode: host`, the container will bind host ports directly. Otherwise, ensure UDP 5060 and UDP 10000-20000 are mapped.

## Networking
For public testing, deploy on a cloud VM with a public IP (or port-forward from your router) and open:
- UDP 5060 (SIP)
- UDP 10000-20000 (RTP)

Set your public IP in any NAT settings if you harden configs.

## SMA configuration
Update the Lambda environment to bridge PSTN to the mixer conference after answer:

- CHIME_BRIDGE_ENDPOINT_URI: `sip:6000@YOUR_PUBLIC_IP`  (or DNS name)

Then redeploy env vars:
```
aws lambda update-function-configuration \
  --function-name chime-sma-bridge \
  --region us-west-2 \
  --environment "Variables={CHIME_BRIDGE_ENDPOINT_URI=sip:6000@YOUR_PUBLIC_IP}"
```

With this set, our handler does:
- NEW_OUTBOUND_CALL/CALL_ANSWERED → CallAndBridge to CHIME_BRIDGE_ENDPOINT_URI
- ACTION_SUCCESSFUL → Speak + Pause to keep media flowing (avoid carrier idle hangup)

## How the browser participates
Currently, the web app creates a Chime meeting for the Azure agent audio. To mix that audio with the PSTN in the Asterisk conference, you have two options:

A) Quick interim: run a softphone (e.g., Linphone/ZoiPer) that dials `sip:6000@YOUR_PUBLIC_IP` and sets its audio input to your system sound (where the Azure agent is playing). This is a manual proxy to validate two-way audio and transcription.

B) Proper integration (recommended): add a small SIP WebRTC client in the web app that, when the bridge starts, dials the Asterisk conference over WebSocket (PJSIP + sip.js). This connects the same browser session (Azure agent audio output) into the conference, enabling true two-way with the PSTN leg SMA bridged.

I can add option (B) next (sip.js integration with a simple dialer to room 6000). Once in place, SMA’s CallAndBridge will bring the PSTN leg into the same room, and your agent transcriptions will include the PSTN voice.

## Troubleshooting
- If calls connect but drop after ~30s of silence, ensure we’re returning periodic Speak or have active media (done in Lambda now).
- One-way audio? Check RTP ports and that your firewall allows 10000-20000/udp in both directions.
- If SIP INVITEs don’t reach Asterisk: verify 5060/udp is reachable and not blocked by NAT.

## Next steps
1) Confirm this mixer runs and is reachable: from an external softphone, dial `sip:6000@YOUR_PUBLIC_IP` and verify you join conference 6000.
2) Set CHIME_BRIDGE_ENDPOINT_URI to the SIP URI above and test an outbound call; the PSTN should land in conference 6000.
3) I will add a minimal sip.js dialer to the app so the browser joins the same conference automatically on Call.
