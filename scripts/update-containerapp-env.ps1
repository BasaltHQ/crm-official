$ErrorActionPreference = 'Stop'

# Resource info
$id = '/subscriptions/0a8c8695-c09e-45cc-8a64-697faedee923/resourceGroups/ledger1-rt-gw/providers/Microsoft.App/containerApps/ledger1-gateway'
$api = '2025-01-01'
$baseUrl = "https://management.azure.com$id"

Write-Host "Fetching Container App resource..."
$resJson = az rest --method get --url $baseUrl --url-parameters "api-version=$api"
$res = $resJson | ConvertFrom-Json

# Locate container by name
$containers = $res.properties.template.containers
$container = $containers | Where-Object { $_.name -eq 'ledger1-gateway' }
if (-not $container) { throw "Container 'ledger1-gateway' not found." }

# Helper to set or add env vars (preserve secretRef if provided)
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

# Preserve existing envs by name
$byName = @{}
foreach ($e in $envs) { $byName[$e.name] = $e }

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
# Preserve secret refs for keys if already present (no new secrets added here)
Set-Or-Add-Env ([ref]$envs) 'AZURE_OPENAI_API_KEY'              '' 'azure-openai-api-key'
Set-Or-Add-Env ([ref]$envs) 'GATEWAY_SHARED_SECRET'             '' 'gateway-shared-secret'

# Preserve registries; omit secrets to avoid validation errors
$registries = $res.properties.configuration.registries

# Prepare minimal PATCH body with image + full env array and registries
$bodyObj = [ordered]@{
  properties = [ordered]@{
    configuration = [ordered]@{
      registries = $registries
    }
    template = [ordered]@{
      containers = @(
        [ordered]@{
          name = $container.name
          image = $container.image
          env = $envs
        }
      )
    }
  }
}

$temp = [System.IO.Path]::GetTempFileName()
$bodyJson = $bodyObj | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($temp, $bodyJson)
Write-Host "PATCH body written to $temp"

# Apply PATCH using inline JSON
Write-Host "Applying PATCH to update env..."
az rest --method patch --url $baseUrl --url-parameters "api-version=$api" --headers "Content-Type=application/json" --body "@${temp}"

# Verify update
Write-Host "Verifying updated env values..."
az rest --method get --url $baseUrl --url-parameters "api-version=$api" --query "properties.template.containers[0].env" --output json
