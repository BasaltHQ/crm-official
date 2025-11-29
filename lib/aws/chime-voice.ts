import { ChimeSDKVoiceClient, CreateSipMediaApplicationCallCommand } from "@aws-sdk/client-chime-sdk-voice";

function getEnv(name: string, required = false): string | undefined {
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) throw new Error(`Missing required env var: ${name}`);
  return v?.toString().trim();
}

let _client: ChimeSDKVoiceClient | null = null;
function client(): ChimeSDKVoiceClient {
  if (_client) return _client;
  const region = getEnv("AWS_REGION") || getEnv("CHIME_VOICE_REGION") || "us-west-2";
  _client = new ChimeSDKVoiceClient({ region });
  return _client;
}

export type CreateSmaCallOptions = {
  sipMediaApplicationId?: string; // falls back to CHIME_SMA_APPLICATION_ID
  destinationPhoneNumber: string; // E.164
  sourcePhoneNumber?: string; // falls back to CHIME_SOURCE_PHONE
  argumentsMap?: Record<string, string>; // passed to SMA Lambda in event.CallDetails.Attributes
  sipHeaders?: Record<string, string>; // optional SIP headers
};

export async function createSipMediaApplicationCall(opts: CreateSmaCallOptions): Promise<{ transactionId: string }>{
  const smaId = opts.sipMediaApplicationId || getEnv("CHIME_SMA_APPLICATION_ID", true)!;
  const dest = opts.destinationPhoneNumber;
  const src = opts.sourcePhoneNumber || getEnv("CHIME_SOURCE_PHONE");
  if (!dest || !dest.trim()) throw new Error("destinationPhoneNumber is required (E.164)");

  const cmd = new CreateSipMediaApplicationCallCommand({
    FromPhoneNumber: src,
    ToPhoneNumber: dest,
    SipMediaApplicationId: smaId,
    SipHeaders: opts.sipHeaders,
    ArgumentsMap: opts.argumentsMap,
  });
  const res = await client().send(cmd);
  const txId = res?.SipMediaApplicationCall?.TransactionId || (res as any)?.TransactionId;
  if (!txId) throw new Error("CreateSipMediaApplicationCall returned no TransactionId");
  return { transactionId: txId };
}
