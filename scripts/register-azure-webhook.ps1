param(
  [Parameter(Mandatory=$true)][string]$EndpointBase,   # e.g. https://<resource>.cognitiveservices.azure.com
  [Parameter(Mandatory=$true)][string]$ApiKey,         # Azure OpenAI API key
  [Parameter(Mandatory=$false)][string]$WebhookUrl,    # e.g. https://your-app.example.com/api/azure/webhook
  [string[]]$EventTypes = @('response.completed','realtime.call.incoming'),
  [ValidateSet('create','list','delete','update')][string]$Action = 'create',
  [string]$WebhookId,
  [string]$Name
)
$ErrorActionPreference = 'Stop'

function New-WebhookBody {
  param([string]$url, [string[]]$events, [string]$name)
  $obj = [ordered]@{
    url = $url
    event_types = @($events)
  }
  if ($name) { $obj.name = $name }
  return ($obj | ConvertTo-Json -Depth 10)
}

$base = $EndpointBase.TrimEnd('/')
$ep = "$base/openai/v1/dashboard/webhook_endpoints"
$headers = @{ 'api-key' = $ApiKey; 'Content-Type' = 'application/json' }
# Normalize EventTypes if passed as a single comma-separated string
if ($EventTypes.Count -eq 1 -and $EventTypes[0] -match ',') {
  $EventTypes = $EventTypes[0].Split(',') | ForEach-Object { $_.Trim() }
}

switch ($Action) {
  'list' {
    Write-Host "Listing webhook endpoints from $ep" -ForegroundColor Cyan
    $resp = Invoke-RestMethod -Method GET -Uri $ep -Headers $headers
    $resp | ConvertTo-Json -Depth 10
    break
  }
  'delete' {
    if (-not $WebhookId) { throw 'When Action=delete, -WebhookId is required.' }
    $url = "$ep/$WebhookId"
    Write-Host "Deleting webhook endpoint $WebhookId" -ForegroundColor Yellow
    Invoke-RestMethod -Method DELETE -Uri $url -Headers @{ 'api-key' = $ApiKey; 'Accept' = 'application/json' }
    Write-Host "Deleted." -ForegroundColor Green
    break
  }
  'update' {
    if (-not $WebhookId) { throw 'When Action=update, -WebhookId is required.' }
    $url = "$ep/$WebhookId"
    Write-Host "Updating webhook endpoint $WebhookId" -ForegroundColor Cyan
    $bodyJson = New-WebhookBody -url $WebhookUrl -events $EventTypes -name $Name
    $resp = Invoke-RestMethod -Method POST -Uri $url -Headers $headers -Body $bodyJson
    $resp | ConvertTo-Json -Depth 10
    break
  }
  'create' {
    if (-not $WebhookUrl) { throw 'When Action=create, -WebhookUrl is required.' }
    $nm = if ($Name) { $Name } else { 'ledger1-webhook-' + (Get-Date).ToString('yyyyMMddHHmmss') }
    Write-Host "Creating webhook endpoint at $WebhookUrl for events: $($EventTypes -join ', ')" -ForegroundColor Cyan
    $bodyJson = New-WebhookBody -url $WebhookUrl -events $EventTypes -name $nm
    $resp = Invoke-RestMethod -Method POST -Uri $ep -Headers $headers -Body $bodyJson
    $resp | ConvertTo-Json -Depth 10
    if ($resp.signing_secret_hint) {
      Write-Host "Note: signing_secret is only shown once at creation. Store it securely in Key Vault or app settings." -ForegroundColor Yellow
      Write-Host ("Signing secret hint: " + $resp.signing_secret_hint) -ForegroundColor Yellow
    }
    break
  }
}
