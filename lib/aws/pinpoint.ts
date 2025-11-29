import { PinpointClient, SendMessagesCommand, type AddressConfiguration, type SMSMessage } from "@aws-sdk/client-pinpoint";

export type SendSmsOptions = {
  to: string | string[]; // E.164 numbers, e.g. +15551234567
  body: string;
  applicationId?: string; // defaults to env PINPOINT_APPLICATION_ID
  originationNumber?: string; // E.164, required if not using senderId
  senderId?: string; // e.g. "TUCCRM" (region dependent)
  messageType?: "PROMOTIONAL" | "TRANSACTIONAL"; // default TRANSACTIONAL
};

function getEnv(name: string, required = false): string | undefined {
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v?.trim();
}

let _client: PinpointClient | null = null;
function client(): PinpointClient {
  if (_client) return _client;
  const region = getEnv("PINPOINT_REGION") || getEnv("AWS_REGION") || "us-east-1";
  _client = new PinpointClient({ region });
  return _client;
}

export async function sendSmsPinpoint(opts: SendSmsOptions): Promise<{ results: Record<string, { messageId?: string; status?: string; }>; }>{
  const to = Array.isArray(opts.to) ? opts.to.filter(Boolean) : [opts.to].filter(Boolean);
  if (to.length === 0) throw new Error("sendSmsPinpoint requires at least one destination number");

  const applicationId = opts.applicationId || getEnv("PINPOINT_APPLICATION_ID", true)!;
  const originationNumber = opts.originationNumber || getEnv("PINPOINT_SMS_ORIGINATION_NUMBER") || undefined;
  const senderId = opts.senderId || getEnv("PINPOINT_SMS_SENDER_ID") || undefined;
  const messageType: "PROMOTIONAL" | "TRANSACTIONAL" = opts.messageType || "TRANSACTIONAL";

  const addresses: Record<string, AddressConfiguration> = {};
  for (const num of to) {
    addresses[num] = { ChannelType: "SMS" };
  }

  const smsConfig: SMSMessage = {
    Body: opts.body,
    MessageType: messageType,
    // Only one of OriginationNumber or SenderId may be used depending on setup
    ...(originationNumber ? { OriginationNumber: originationNumber } : {}),
    ...(senderId ? { SenderId: senderId } : {}),
  };

  const cmd = new SendMessagesCommand({
    ApplicationId: applicationId,
    MessageRequest: {
      Addresses: addresses,
      MessageConfiguration: { SMSMessage: smsConfig },
    },
  });

  try {
    const res = await client().send(cmd);
    const out: Record<string, { messageId?: string; status?: string; }> = {};
    const results = res?.MessageResponse?.Result || {};
    for (const [key, val] of Object.entries(results)) {
      out[key] = { messageId: val?.MessageId, status: val?.StatusCode?.toString() };
    }
    return { results: out };
  } catch (err: any) {
    const msg = err?.message || String(err);
    throw new Error(`[PINPOINT_SMS_FAILED] ${msg}`);
  }
}
