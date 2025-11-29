$ErrorActionPreference = 'Stop'

# Local/Tunnel webhook URL (adjust if your tunnel URL changed)
$webhookUrl = 'https://sour-turkeys-feel.loca.lt/api/azure/webhook'

# Prepare headers per Azure docs (intentionally invalid signature for readiness test)
$timestamp = [int][double]::Parse((Get-Date -UFormat %s))
$headers = @{
  'Content-Type'      = 'application/json'
  'Webhook-ID'        = 'test-id'
  'Webhook-Timestamp' = "$timestamp"
  'Webhook-Signature' = 'v1,test-signature'
}

# Sample event payload (response.completed) — signature will not validate, expected 400
$payload = @{
  object     = 'event'
  id         = 'evt_test_event'
  type       = 'response.completed'
  created_at = $timestamp
  data       = @{ call_id = 'test-call'; sip_headers = @() }
} | ConvertTo-Json -Depth 10

Write-Host "Posting test webhook with invalid signature to $webhookUrl ..."
try {
  $resp = Invoke-RestMethod -Method Post -Uri $webhookUrl -Headers $headers -Body $payload
  Write-Host "Status Code: 200 (unexpected if signature is invalid)"
  $resp | ConvertTo-Json -Depth 10
} catch {
  if ($_.Exception.Response -and $_.Exception.Response.StatusCode -eq 400) {
    Write-Host "Status Code: 400"
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body   = $reader.ReadToEnd()
    Write-Host "Response: $body"
  } else {
    Write-Host "Request failed: $($_.Exception.Message)"
  }
}
