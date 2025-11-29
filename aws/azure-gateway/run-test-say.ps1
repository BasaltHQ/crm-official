param(
  [string]$GatewayUrl = "ws://localhost:8080",
  [string]$Secret = $env:GATEWAY_SHARED_SECRET,
  [string]$Text = "Hello from the bridge",
  [string]$OutEncoding = "pcm16",
  [int]$OutSampleRate = 16000,
  [string]$OutFile = "out.wav",
  [string]$CallId = "say-" + [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
)

if (-not $Secret) { $Secret = $env:GATEWAY_SECRET }

Write-Host "Preparing environment for test-say..." -ForegroundColor Cyan
$env:GATEWAY_URL = $GatewayUrl
$env:GATEWAY_SHARED_SECRET = $Secret
$env:SAY_TEXT = $Text
$env:OUT_ENCODING = $OutEncoding
$env:OUT_SAMPLE_RATE = [string]$OutSampleRate
$env:OUT_FILE = $OutFile
$env:CALL_ID = $CallId

Write-Host "Using settings:" -ForegroundColor Cyan
Write-Host " GATEWAY_URL        = $env:GATEWAY_URL"
Write-Host " GATEWAY_SHARED_SECRET (len) = $($env:GATEWAY_SHARED_SECRET.Length)"
Write-Host " SAY_TEXT           = $env:SAY_TEXT"
Write-Host " OUT_ENCODING       = $env:OUT_ENCODING"
Write-Host " OUT_SAMPLE_RATE    = $env:OUT_SAMPLE_RATE"
Write-Host " OUT_FILE           = $env:OUT_FILE"
Write-Host " CALL_ID            = $env:CALL_ID"

Write-Host "Running pnpm test-say..." -ForegroundColor Green
pnpm run test-say
