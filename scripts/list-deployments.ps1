$ErrorActionPreference = 'Stop'

# Azure OpenAI resource endpoint and API key
$base    = 'https://skyne-m9q617jz-swedencentral.cognitiveservices.azure.com'
$url     = "$base/openai/deployments?api-version=2025-04-01-preview"
$headers = @{ 'api-key' = '3kOpQcb3zZ9vlaskow3k5TMPlVyvseoK1AAD4vHxovvYjHReugIYJQQJ99BDACfhMk5XJ3w3AAAAACOGbV8B' }

Write-Host "Listing Azure OpenAI deployments from $url ..."
$response = Invoke-RestMethod -Method Get -Uri $url -Headers $headers
$response | ConvertTo-Json -Depth 20
