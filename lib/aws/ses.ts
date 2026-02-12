import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

export type SendEmailOptions = {
  to: string | string[];
  from?: string; // defaults to env SES_FROM_ADDRESS
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string | string[];
  configurationSet?: string; // optional SES configuration set name
};

function getEnv(name: string, required = false): string | undefined {
  const v = process.env[name];
  if (required && (!v || !String(v).trim())) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v?.trim();
}

// Singleton client to avoid socket churn
let _client: SESv2Client | null = null;
function client(): SESv2Client {
  if (_client) return _client;
  const region = getEnv("SES_REGION") || getEnv("AWS_REGION") || "us-east-1";

  // FIX: Bypass SSL certificate issues in development
  if (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_URL?.includes('localhost')) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  _client = new SESv2Client({ region });
  return _client;
}

export async function sendEmailSES(opts: SendEmailOptions): Promise<{ messageId?: string }> {
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  const from = opts.from || getEnv("SES_FROM_ADDRESS", true)!;
  const replyTo = opts.replyTo ? (Array.isArray(opts.replyTo) ? opts.replyTo : [opts.replyTo]) : undefined;
  const configurationSet = opts.configurationSet || getEnv("SES_CONFIGURATION_SET") || undefined;

  const subject = opts.subject || "";
  const html = opts.html && String(opts.html).trim().length ? String(opts.html) : undefined;
  const text = opts.text && String(opts.text).trim().length ? String(opts.text) : undefined;

  if (!html && !text) {
    throw new Error("sendEmailSES requires either html or text body");
  }

  const Body: any = {};
  if (text) Body.Text = { Data: text, Charset: "UTF-8" };
  if (html) Body.Html = { Data: html, Charset: "UTF-8" };

  const cmd = new SendEmailCommand({
    FromEmailAddress: from,
    Destination: { ToAddresses: to },
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body,
      },
    },
    ReplyToAddresses: replyTo,
    ConfigurationSetName: configurationSet,
  });

  try {
    const res = await client().send(cmd);
    return { messageId: res?.MessageId };
  } catch (err: any) {
    // Forward a concise error
    const msg = err?.message || String(err);
    throw new Error(`[SES_SEND_FAILED] ${msg}`);
  }
}
