$ErrorActionPreference = 'Stop'

# Resource info
$id = '/subscriptions/0a8c8695-c09e-45cc-8a64-697faedee923/resourceGroups/ledger1-rt-gw/providers/Microsoft.App/containerApps/ledger1-gateway'
$api = '2025-01-01'
$baseUrl = "https://management.azure.com$id"

Write-Host "Fetching Container App env..."
$resJson = az rest --method get --url $baseUrl --url-parameters "api-version=$api"
$res = $resJson | ConvertFrom-Json
$container = $res.properties.template.containers[0]
$envs = $container.env

# Update deployment value precisely
foreach ($env in $envs) { if ($env.name -eq 'AZURE_OPENAI_REALTIME_DEPLOYMENT') { $env.value = 'gpt-realtime' } }

# Build minimal PATCH body: template.containers with image + updated env array
$bodyObj = [ordered]@{ properties = [ordered]@{ template = [ordered]@{ containers = @([ordered]@{ name = $container.name; image = $container.image; env = $envs }) } } }
$temp = [System.IO.Path]::GetTempFileName()
$bodyJson = $bodyObj | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($temp, $bodyJson)
Write-Host "PATCH body written to $temp"

Write-Host "Applying PATCH..."
az rest --method patch --url $baseUrl --url-parameters "api-version=$api" --headers "Content-Type=application/json" --body "@${temp}"

Write-Host "Verifying env..."
az rest --method get --url $baseUrl --url-parameters "api-version=$api" --query "properties.template.containers[0].env" --output json
