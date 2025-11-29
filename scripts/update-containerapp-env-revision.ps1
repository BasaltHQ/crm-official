$ErrorActionPreference = 'Stop'

# Resource info
$id = '/subscriptions/0a8c8695-c09e-45cc-8a64-697faedee923/resourceGroups/ledger1-rt-gw/providers/Microsoft.App/containerApps/ledger1-gateway'
$api = '2025-01-01'
$baseUrl = "https://management.azure.com$id"

Write-Host "Fetching Container App resource..."
$resJson = az rest --method get --url $baseUrl --url-parameters "api-version=$api"
$res = $resJson | ConvertFrom-Json

# Grab full containers array
$containers = $res.properties.template.containers
if (-not $containers -or $containers.Count -lt 1) { throw "No containers found in template." }

# Update env vars in the first container by name
$target = $containers[0]
foreach ($env in $target.env) {
  switch ($env.name) {
    'AZURE_OPENAI_REALTIME_WS_URL' { $env.value = 'wss://skyne-m9q617jz-swedencentral.cognitiveservices.azure.com/openai/realtime' }
    'AZURE_OPENAI_REALTIME_API_VERSION' { $env.value = '2024-10-01-preview' }
    'AZURE_OPENAI_REALTIME_DEPLOYMENT' { $env.value = 'gpt-realtime' }
  }
}

# Build PATCH body with full containers array and a new revisionSuffix
$rev = "swedencentral-" + (Get-Date).ToString('yyyyMMddHHmmss')
$bodyObj = [ordered]@{
  properties = [ordered]@{
    template = [ordered]@{
      revisionSuffix = $rev
      containers     = $containers
    }
  }
}

$temp = [System.IO.Path]::GetTempFileName()
$bodyJson = $bodyObj | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($temp, $bodyJson)
Write-Host "PATCH body (with revisionSuffix) written to $temp"

Write-Host "Applying PATCH to update env + revision..."
az rest --method patch --url $baseUrl --url-parameters "api-version=$api" --headers "Content-Type=application/json" --body "@${temp}"

Write-Host "Verifying updated env values..."
az rest --method get --url $baseUrl --url-parameters "api-version=$api" --query "properties.template.containers[0].env" --output json
