$ErrorActionPreference = 'Stop'

# Azure endpoint and key (for local test)
$base    = 'https://panopticon.cognitiveservices.azure.com/'
$url     = "$base/openai/v1/responses?api-version=preview"
$headers = @{ 'api-key' = 'aefad978082243b2a79e279b203efc29' ; 'Content-Type' = 'application/json' }

# Background response to trigger response.completed webhook
$body = @"
{
  "model": "gpt-realtime",
  "input": "Webhook ping from local dev. Please acknowledge.",
  "background": true,
  "store": true
}
"@

Write-Host "Triggering background response to fire webhook (response.completed) ..."
$response = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -Body $body
$response | ConvertTo-Json -Depth 10
