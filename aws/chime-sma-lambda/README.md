# Deploy and Provision AWS Chime SDK PSTN Bridge (SMA + Voice Connector)

This folder contains a prototype SIP Media Application (SMA) Lambda (handler.ts) and a SAM template (template.yaml) to bridge PSTN to an Amazon Chime SDK meeting. Follow these steps to deploy and provision telephony.

## Prerequisites
- AWS CLI and SAM CLI installed
- AWS credentials configured (admin or appropriate IAM privileges)
- Node.js 18+ for Lambda build

## 1) Deploy the SMA Lambda
From `nextcrm-app/aws/chime-sma-lambda` run:

```bash
sam build
sam deploy \
  --stack-name chime-sma-bridge \
  --parameter-overrides ChimeRegion=us-west-2 ChimeMeetingRegion=us-west-2 FunctionName=chime-sma-bridge \
  --capabilities CAPABILITY_IAM
```

Outputs will include the Lambda function ARN. In the Chime SDK console, you will link this Lambda in a SIP Media Application.

## 2) Provision Voice Connector and Phone Number
Use the AWS CLI for Chime SDK Voice. Replace placeholders with your values.

```bash
# Create a Voice Connector (basic example)
aws chime-sdk-voice create-voice-connector \
  --name MyVoiceConnector \
  --require-encryption false \
  --region us-west-2

# Get Voice Connector details
aws chime-sdk-voice list-voice-connectors --region us-west-2

# (Option A) Associate an existing phone number (ported/claimed) to the Voice Connector
# If you have a PhoneNumberId already:
aws chime-sdk-voice associate-phone-numbers-with-voice-connector \
  --voice-connector-id <VoiceConnectorId> \
  --e164-phone-numbers "+1XXXXXXXXXX" \
  --region us-west-2

# (Option B) Search and order a new number (availability varies by region)
aws chime-sdk-voice list-available-phone-numbers \
  --product-type VoiceConnector \
  --region us-west-2
# Then create an ordered phone number (API varies; consult console for ordering/porting)
```

## 3) Create SIP Media Application and SIP Rule
Create a SIP Media Application pointing to the deployed Lambda, then route your Voice Connector number to the SMA.

```bash
# Create SIP Media Application (SMA)
aws chime-sdk-voice create-sip-media-application \
  --name MySma \
  --region us-west-2 \
  --endpoints '[{"LambdaArn":"arn:aws:lambda:us-west-2:<AccountId>:function:chime-sma-bridge"}]'

# Get SMA details
aws chime-sdk-voice list-sip-media-applications --region us-west-2

# Create SIP Rule to route inbound calls to the SMA
aws chime-sdk-voice create-sip-rule \
  --name MySmaRule \
  --trigger-type RequestUriHostname \
  --trigger-value <YourVoiceConnectorInboundHostname> \
  --disabled false \
  --target-applications '[{"SipMediaApplicationId":"<SmaId>","Priority":1,"Region":"us-west-2"}]' \
  --region us-west-2

# Alternatively, for direct number routing (varies by setup), use RequestUriHostname and ensure your inbound route points to the Voice Connector/SMA
aws chime-sdk-voice list-sip-rules --region us-west-2
```

Notes:
- Inbound routing depends on your Voice Connector setup. Many deployments use RequestUriHostname matching the Voice Connector’s inbound host.
- You can create multiple rules to handle different numbers/hosts.

## 4) Wire the Web App
- Set environment variables in `.env.local`:
  - `CHIME_REGION=us-west-2`
  - `CHIME_APP_MEETING_REGION=us-west-2`
  - `CHIME_SMA_PHONE_NUMBER=+1XXXXXXXXXX`
- Start your CRM and use `ChimeBridgePanel` to join a Chime meeting.
- In your Azure Realtime code, set the hidden audio element’s `srcObject` in `ChimeBridgePanel`:

```ts
// Example: inside your Azure panel where you receive remote audio
const audioEl = document.querySelector('#azure-audio') as HTMLAudioElement;
audioEl.srcObject = azureRemoteStream;
```

## 5) Test End-to-End
1. Call the phone number associated with your Voice Connector.
2. The SIP Rule should route to the SMA Lambda. The Lambda speaks a greeting (prototype) and (once you implement CallAndBridge) connects PSTN into the Chime meeting.
3. With the browser in the Chime meeting, confirm full-duplex audio between PSTN and Azure/agent.

## 6) Implement CallAndBridge
The prototype includes a placeholder. Depending on your bridge approach, update `handler.ts`:
- Use `CallAndBridge` with `Endpoints` that target your conferencing/bridge service.
- Or manage meeting join flows via your backend and direct PSTN into the same bridge.

## IAM and Policies
SAM template includes minimal IAM for Chime meetings and CloudWatch Logs. Adjust as needed.

## Troubleshooting
- If meeting creation fails, ensure `ExternalMeetingId` is set and your IAM allows Chime meetings in the target region.
- Confirm the SIP Rule trigger matches your inbound route (hostname) and the SMA ID is correct.
- Verify `ChimeBridgePanel` finds the Azure audio stream; otherwise it falls back to microphone.
