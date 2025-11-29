/*
 SQS Poller for Chime VC Streaming Events
 - Reads EventBridge-delivered events from SQS and extracts per-call session specifics
 - Logs key fields: source, detail-type, time, and the detail payload (parsed if JSON)
 - Intended to run alongside the consumer to hydrate session metadata store

 Usage (after adding @aws-sdk/client-sqs):
   npx ts-node src/sqs-poller.ts --queue-url https://sqs.us-west-2.amazonaws.com/<acct>/ledger1-vc-streaming-events --region us-west-2

 Note: This does not delete messages by default; pass --delete to remove after processing.
*/

import { SQSClient, ReceiveMessageCommand, DeleteMessageBatchCommand } from '@aws-sdk/client-sqs';

function parseArgs() {
  const args = process.argv.slice(2);
  const out: any = { region: process.env.AWS_REGION || 'us-west-2', wait: 10, max: 10, delete: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--queue-url') out.queueUrl = args[++i];
    else if (a === '--region') out.region = args[++i];
    else if (a === '--wait') out.wait = Number(args[++i]);
    else if (a === '--max') out.max = Number(args[++i]);
    else if (a === '--delete') out.delete = true;
  }
  if (!out.queueUrl) throw new Error('Missing --queue-url');
  return out;
}

function safeJSON(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}

async function main() {
  const { queueUrl, region, wait, max, delete: doDelete } = parseArgs();
  const sqs = new SQSClient({ region });

  console.log('[sqs-poller] polling', { queueUrl, region, wait, max, delete: doDelete });

  const cmd = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: max,
    WaitTimeSeconds: wait,
    AttributeNames: ['All'],
    MessageAttributeNames: ['All'],
  });

  const resp = await sqs.send(cmd);
  const msgs = resp.Messages || [];
  if (!msgs.length) {
    console.log('[sqs-poller] no messages');
    return;
  }

  for (const m of msgs) {
    const body = m.Body || '';
    const evt = safeJSON(body);
    if (evt && evt['detail-type']) {
      const detailRaw = typeof evt.detail === 'string' ? evt.detail : JSON.stringify(evt.detail);
      const detail = typeof evt.detail === 'string' ? safeJSON(evt.detail) : evt.detail;
      console.log('--- EventBridge Message ---');
      console.log('source:', evt.source);
      console.log('detail-type:', evt['detail-type']);
      console.log('time:', evt.time);
      console.log('resources:', evt.resources);
      console.log('detailRaw:', detailRaw);
      if (detail) {
        console.log('detail.parsed:', detail);
        // Attempt to surface likely session fields
        const { action, voiceConnectorId, callId, streamArn, transactionId } = detail as any;
        console.log('sessionFields:', { action, voiceConnectorId, callId, streamArn, transactionId });
      }
    } else {
      console.log('--- Non-EventBridge Message ---');
      console.log(body);
    }
  }

  if (doDelete) {
    const entries = msgs.map(m => ({ Id: m.MessageId!, ReceiptHandle: m.ReceiptHandle! }));
    const del = new DeleteMessageBatchCommand({ QueueUrl: queueUrl, Entries: entries });
    const delResp = await sqs.send(del);
    console.log('[sqs-poller] delete batch result:', delResp);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
