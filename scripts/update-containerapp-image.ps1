param(
  [string]$NewTag = '20251117143630'
)
$ErrorActionPreference = 'Stop'

# Resource info
$subId      = '0a8c8695-c09e-45cc-8a64-697faedee923'
$rgName     = 'ledger1-rt-gw'
$appName    = 'ledger1-gateway'
$apiVersion = '2025-01-01'
$resourceId = "/subscriptions/$subId/resourceGroups/$rgName/providers/Microsoft.App/containerApps/$appName"
$baseUrl    = "https://management.azure.com$resourceId"

Write-Host "Fetching Container App resource..."
$resJson = az rest --method get --url $baseUrl --url-parameters "api-version=$apiVersion"
$res     = $resJson | ConvertFrom-Json

# Preserve registries and set the image to the new tag
$containers  = $res.properties.template.containers
$registries  = $res.properties.configuration.registries
$containers[0].image = "ledger1acr.azurecr.io/azure-realtime-gateway:$NewTag"

# Prepare PATCH body including registries and revisionSuffix
$rev = "image-" + $NewTag
$bodyObj = [ordered]@{
  properties = [ordered]@{
    configuration = [ordered]@{ registries = $registries }
    template      = [ordered]@{
      revisionSuffix = $rev
      containers     = $containers
    }
  }
}

$temp    = [System.IO.Path]::GetTempFileName()
$bodyJson = $bodyObj | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($temp, $bodyJson)
Write-Host "PATCH body written to $temp"

Write-Host "Applying PATCH to set image ledger1acr.azurecr.io/azure-realtime-gateway:$NewTag ..."
az rest --method patch --url $baseUrl --url-parameters "api-version=$apiVersion" --headers "Content-Type=application/json" --body "@${temp}"

Write-Host "Verifying updated image..."
az rest --method get --url $baseUrl --url-parameters "api-version=$apiVersion" --query "properties.template.containers[0].image" --output tsv
