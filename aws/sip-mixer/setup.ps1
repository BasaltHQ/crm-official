Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$etc = Join-Path $root 'asterisk\etc'
$var = Join-Path $root 'asterisk\var'
$log = Join-Path $root 'asterisk\log'

New-Item -ItemType Directory -Force -Path $etc | Out-Null
New-Item -ItemType Directory -Force -Path $var | Out-Null
New-Item -ItemType Directory -Force -Path $log | Out-Null

# -----------------
# pjsip.conf
# -----------------
$pjsip = @'
[global]
; global defaults

[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060

; WARNING: For testing only. Restrict by IPs/auth in production.
[anonymous]
type=endpoint
context=public
allow=ulaw,alaw,opus
disallow=all
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
'@

Set-Content -LiteralPath (Join-Path $etc 'pjsip.conf') -Value $pjsip -Encoding UTF8

# -----------------
# extensions.conf
# -----------------
$ext = @'
[general]
static=yes
writeprotect=no
clearglobalvars=no

[public]
; Conference room 6000
exten => 6000,1,NoOp(Join conference 6000)
 same => n,ConfBridge(6000)
 same => n,Hangup()

; Echo test at 6001
exten => 6001,1,Answer()
 same => n,Playback(demo-echotest)
 same => n,Echo()
 same => n,Hangup()
'@

Set-Content -LiteralPath (Join-Path $etc 'extensions.conf') -Value $ext -Encoding UTF8

# -----------------
# confbridge.conf
# -----------------
$conf = @'
[general]

[default_bridge]

[default_user]

[6000]
type=bridge
max_members=50

[6000_user]
; default user profile
'@

Set-Content -LiteralPath (Join-Path $etc 'confbridge.conf') -Value $conf -Encoding UTF8

# -----------------
# rtp.conf
# -----------------
$rtp = @'
[general]
rtpstart=10000
rtpend=20000
'@

Set-Content -LiteralPath (Join-Path $etc 'rtp.conf') -Value $rtp -Encoding UTF8

# -----------------
# http.conf (optional, for WS/WebRTC later)
# -----------------
$http = @'
[general]
enable=yes
bindaddr=0.0.0.0
bindport=8088
'@

Set-Content -LiteralPath (Join-Path $etc 'http.conf') -Value $http -Encoding UTF8

Write-Host "Asterisk config written under: $etc" -ForegroundColor Green

# Bring up mixer using docker compose
try {
  Push-Location $root
  if (Test-Path (Join-Path $root 'docker-compose.yml')) {
    Write-Host "Starting Asterisk mixer via docker compose..." -ForegroundColor Cyan
    docker compose up -d
    Write-Host "Mixer container started (sip-mixer)." -ForegroundColor Green
  } else {
    Write-Warning "docker-compose.yml not found at $root. Create it first, then run: docker compose up -d"
  }
} finally {
  Pop-Location
}

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1) Expose UDP 5060 and UDP 10000-20000 from this host if testing externally." -ForegroundColor Yellow
Write-Host "2) Test from a softphone: dial sip:6000@<YOUR_PUBLIC_IP> and confirm you hear conference room 6000." -ForegroundColor Yellow
Write-Host "3) Set CHIME_BRIDGE_ENDPOINT_URI in Lambda to sip:6000@<YOUR_PUBLIC_IP> and redeploy function configuration." -ForegroundColor Yellow
Write-Host "   aws lambda update-function-configuration --function-name chime-sma-bridge --region us-west-2 --environment \"Variables={CHIME_BRIDGE_ENDPOINT_URI=sip:6000@YOUR_PUBLIC_IP}\"" -ForegroundColor DarkGray
Write-Host "4) Place an outbound call from the dial pad; PSTN leg should bridge to conference 6000." -ForegroundColor Yellow
