param(
  [Parameter(Mandatory=$true)][string]$GatewayUrl,
  [Parameter(Mandatory=$true)][string]$Secret,
  [string]$CallId = "test-bridge-cli",
  [int]$SampleRate = 8000,
  [int]$DurationMs = 15000,
  [int]$FreqHz = 440
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$env:GATEWAY_URL = $GatewayUrl
$env:GATEWAY_SECRET = $Secret
$env:CALL_ID = $CallId
$env:IN_SAMPLE_RATE = "$SampleRate"
$env:DURATION_MS = "$DurationMs"
$env:FREQ_HZ = "$FreqHz"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Error "npm not found in PATH" }
# Ensure deps, then run the tone test
npm install --silent | Out-Null
npx ts-node src\test-sine.ts
