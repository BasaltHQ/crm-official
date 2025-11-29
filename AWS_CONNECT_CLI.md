AWS Connect CLI Setup and Validation (us-west-2)

Quick one-liners (PowerShell)
- aws configure set region us-west-2
- $IID = (aws connect list-instances --region us-west-2 | ConvertFrom-Json).Instances[0].Id
- $FLOWID = (aws connect list-contact-flows --instance-id $IID --region us-west-2 --contact-flow-types OUTBOUND | ConvertFrom-Json).ContactFlowSummaryList[0].Id
- $QUEUEID = (aws connect list-queues --instance-id $IID --region us-west-2 | ConvertFrom-Json).QueueSummaryList[0].Id
- $envPath = "nextcrm-app/.env.local"; if (-not (Test-Path $envPath)) { New-Item -ItemType File -Path $envPath | Out-Null }; $kv=@{"AWS_REGION"="us-west-2";"CONNECT_INSTANCE_ID"=$IID;"CONNECT_CONTACT_FLOW_ID"=$FLOWID;"CONNECT_QUEUE_ID"=$QUEUEID}; $content=Get-Content $envPath -Raw; foreach ($k in $kv.Keys){ $line = "$k=$($kv[$k])"; if ($content -match "^$k=.*$") { $content = [regex]::Replace($content, "^$k=.*$", $line, [System.Text.RegularExpressions.RegexOptions]::Multiline) } else { if ($content.Length -gt 0 -and -not $content.EndsWith("`r`n")) { $content += "`r`n" }; $content += $line + "`r`n" } }; Set-Content -Path $envPath -Value $content -Encoding UTF8

Start/Status/Stop (PowerShell)
- $CID = (aws connect start-outbound-voice-contact --instance-id $IID --contact-flow-id $FLOWID --destination-phone-number "+1XXXXXXXXXX" --queue-id $QUEUEID --region us-west-2 | ConvertFrom-Json).ContactId
- aws connect describe-contact --instance-id $IID --contact-id $CID --region us-west-2
- aws connect stop-contact --instance-id $IID --contact-id $CID --region us-west-2

Full workflow

1) Identity and Region
- aws sts get-caller-identity
- aws configure list
- aws configure set region us-west-2

2) Discover Amazon Connect InstanceId
- aws connect list-instances --region us-west-2 --output table
- PowerShell example:
  - $IID = (aws connect list-instances --region us-west-2 | ConvertFrom-Json).Instances[0].Id

3) Discover Contact Flow for OUTBOUND
- aws connect list-contact-flows --instance-id $IID --region us-west-2 --output table
- Optional (filter outbound types):
  - aws connect list-contact-flows --instance-id $IID --region us-west-2 --contact-flow-types OUTBOUND --output table
- Set variable:
  - $FLOWID = (aws connect list-contact-flows --instance-id $IID --region us-west-2 --contact-flow-types OUTBOUND | ConvertFrom-Json).ContactFlowSummaryList[0].Id

4) Discover Queue for outbound calls
- aws connect list-queues --instance-id $IID --region us-west-2 --output table
- Set variable:
  - $QUEUEID = (aws connect list-queues --instance-id $IID --region us-west-2 | ConvertFrom-Json).QueueSummaryList[0].Id

5) Validate/Associate S3+KMS storage configs (optional)
- Check existing:
  - aws connect list-instance-storage-configs --instance-id $IID --resource-type CALL_RECORDINGS --region us-west-2
  - aws connect list-instance-storage-configs --instance-id $IID --resource-type CHAT_TRANSCRIPTS --region us-west-2
  - aws connect list-instance-storage-configs --instance-id $IID --resource-type SCHEDULED_REPORTS --region us-west-2
- Associate if missing (replace <bucket>):
  - CALL_RECORDINGS:
    - aws connect associate-instance-storage-config --instance-id $IID --resource-type CALL_RECORDINGS --storage-config '{ "StorageType": "S3", "S3Config": { "BucketName": "<bucket>", "BucketPrefix": "connect/recordings/", "EncryptionConfig": { "EncryptionType": "KMS", "KeyId": "arn:aws:kms:us-west-2:867344432514:key/0f7ee07b-6465-476d-b43c-ee1433431a37" } } }' --region us-west-2
  - CHAT_TRANSCRIPTS:
    - aws connect associate-instance-storage-config --instance-id $IID --resource-type CHAT_TRANSCRIPTS --storage-config '{ "StorageType": "S3", "S3Config": { "BucketName": "<bucket>", "BucketPrefix": "connect/transcripts/", "EncryptionConfig": { "EncryptionType": "KMS", "KeyId": "arn:aws:kms:us-west-2:867344432514:key/0f7ee07b-6465-476d-b43c-ee1433431a37" } } }' --region us-west-2
  - SCHEDULED_REPORTS:
    - aws connect associate-instance-storage-config --instance-id $IID --resource-type SCHEDULED_REPORTS --storage-config '{ "StorageType": "S3", "S3Config": { "BucketName": "<bucket>", "BucketPrefix": "connect/reports/", "EncryptionConfig": { "EncryptionType": "KMS", "KeyId": "arn:aws:kms:us-west-2:867344432514:key/0f7ee07b-6465-476d-b43c-ee1433431a37" } } }' --region us-west-2

6) Confirm CloudWatch logs group presence
- aws logs describe-log-groups --log-group-name-prefix "/aws/connect/" --region us-west-2
- Expect a group like /aws/connect/ledger1crm; if absent, enable logging in the Connect console.

7) Populate nextcrm-app/.env.local
- Ensure AWS_REGION=us-west-2
- Variables already set via quick one-liner.

8) Quick call test via AWS CLI
- $CID = (aws connect start-outbound-voice-contact --instance-id $IID --contact-flow-id $FLOWID --destination-phone-number "+1XXXXXXXXXX" --queue-id $QUEUEID --region us-west-2 | ConvertFrom-Json).ContactId
- aws connect describe-contact --instance-id $IID --contact-id $CID --region us-west-2
- aws connect stop-contact --instance-id $IID --contact-id $CID --region us-west-2

9) Validate app routes
- POST /api/outreach/call/initiate  body: { "destinationPhoneNumber": "+1XXXXXXXXXX" }
- GET  /api/outreach/call/status/$CID
- POST /api/outreach/call/stop/$CID

Troubleshooting
- aws sts get-caller-identity
- aws configure list
- aws configure set region us-west-2
- If list-instance-storage-configs returns errors for a resource type, share the message to adjust commands for your instance capabilities.
