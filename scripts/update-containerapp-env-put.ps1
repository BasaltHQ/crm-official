$ErrorActionPreference = 'Stop'

# Resource info
$id = '/subscriptions/0a8c8695-c09e-45cc-8a64-697faedee923/resourceGroups/ledger1-rt-gw/providers/Microsoft.App/containerApps/ledger1-gateway'
$api = '2025-01-01'
$baseUrl = "https://management.azure.com$id"

Write-Host "Fetching Container App resource..."
$resJson = az rest --method get --url $baseUrl --url-parameters "api-version=$api"
$res = $resJson | ConvertFrom-Json

# Update env values by name in-place and add missing ones
$containers = $res.properties.template.containers
$container = $containers | Where-Object { $_.name -eq 'ledger1-gateway' }
if (-not $container) { throw "Container 'ledger1-gateway' not found." }

# Helper to set or add env vars
function Set-Or-Add-Env([ref]$envArray, [string]$name, [string]$value, [string]$secretRef) {
  $existing = $envArray.Value | Where-Object { $_.name -eq $name }
  if ($existing) {
    if ($secretRef) {
      $existing.PSObject.Properties.Remove('value') | Out-Null
      $existing.secretRef = $secretRef
    } else {
      $existing.PSObject.Properties.Remove('secretRef') | Out-Null
      $existing.value = $value
    }
  } else {
    if ($secretRef) {
      $envArray.Value += @{ name = $name; secretRef = $secretRef }
    } else {
      $envArray.Value += @{ name = $name; value = $value }
    }
  }
}

$envs = @()
if ($container.env) { $envs = $container.env } else { $container.env = @(); $envs = $container.env }

# Desired values
$AZ_URL = 'wss://skyne-m9q617jz-swedencentral.cognitiveservices.azure.com/openai/deployments/gpt-realtime/realtime'
$AZ_VER = '2024-10-01-preview'
$AZ_DEP = 'gpt-realtime'

# Update existing known keys if present
foreach ($env in $envs) {
  switch ($env.name) {
    'AZURE_OPENAI_REALTIME_WS_URL'      { $env.value = $AZ_URL }
    'AZURE_OPENAI_REALTIME_API_VERSION' { $env.value = $AZ_VER }
    'AZURE_OPENAI_REALTIME_DEPLOYMENT'  { $env.value = $AZ_DEP }
    'AUDIO_ENCODING'                    { $env.value = 'mulaw' }
    'SAMPLE_RATE'                       { $env.value = '8000' }
    'AZURE_IN_SAMPLE_RATE'              { $env.value = '16000' }
    'AZURE_OUT_SAMPLE_RATE'             { $env.value = '16000' }
    'FRAME_MS'                          { $env.value = '20' }
    'AZURE_VOICE'                       { $env.value = 'alloy' }
  }
}

# Add any missing desired envs
Set-Or-Add-Env ([ref]$envs) 'AZURE_OPENAI_REALTIME_WS_URL'      $AZ_URL ''
Set-Or-Add-Env ([ref]$envs) 'AZURE_OPENAI_REALTIME_API_VERSION' $AZ_VER ''
Set-Or-Add-Env ([ref]$envs) 'AZURE_OPENAI_REALTIME_DEPLOYMENT'  $AZ_DEP ''
Set-Or-Add-Env ([ref]$envs) 'AUDIO_ENCODING'                    'mulaw' ''
Set-Or-Add-Env ([ref]$envs) 'SAMPLE_RATE'                       '8000' ''
Set-Or-Add-Env ([ref]$envs) 'AZURE_IN_SAMPLE_RATE'              '16000' ''
Set-Or-Add-Env ([ref]$envs) 'AZURE_OUT_SAMPLE_RATE'             '16000' ''
Set-Or-Add-Env ([ref]$envs) 'FRAME_MS'                          '20' ''
Set-Or-Add-Env ([ref]$envs) 'AZURE_VOICE'                       'alloy' ''
Set-Or-Add-Env ([ref]$envs) 'AZURE_OPENAI_API_KEY'              '' 'azure-openai-api-key'
Set-Or-Add-Env ([ref]$envs) 'GATEWAY_SHARED_SECRET'             '' 'gateway-shared-secret'

# Pin image to latest successful build tag if desired
$container.image = 'ledger1acr.azurecr.io/azure-realtime-gateway:20251118125119'

# Build minimal PUT body with location + properties (which includes updated envs and image)
$putBodyObj = [ordered]@{
  location   = $res.location
  properties = $res.properties
}

$temp = [System.IO.Path]::GetTempFileName()
$putBodyJson = $putBodyObj | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($temp, $putBodyJson)
Write-Host "PUT body written to $temp"

Write-Host "Applying PUT to update env (including FRAME_MS=20)..."
az rest --method put --url $baseUrl --url-parameters "api-version=$api" --headers "Content-Type=application/json" --body "@${temp}"

Write-Host "Verifying updated env values..."
az rest --method get --url $baseUrl --url-parameters "api-version=$api" --query "properties.template.containers[0].env" --output json
