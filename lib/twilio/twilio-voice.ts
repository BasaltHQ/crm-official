import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { decryptSecret } from "@/lib/encryption";

/**
 * Twilio Voice Helper
 * Reads Twilio credentials from the tenant's integration settings in the DB.
 */

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
};

/**
 * Load Twilio config for a team from tenant_Integrations.
 * Returns null if Twilio is not enabled or credentials are missing.
 */
export async function getTwilioConfig(teamId: string): Promise<TwilioConfig | null> {
  try {
    const integration = await prismadb.tenant_Integrations.findUnique({
      where: { tenant_id: teamId },
    });

    if (!integration?.twilio_enabled) return null;
    const decryptedToken = decryptSecret(integration.twilio_auth_token);
    if (!integration.twilio_account_sid || !decryptedToken) return null;

    return {
      accountSid: integration.twilio_account_sid,
      authToken: decryptedToken,
      phoneNumber: integration.twilio_phone_number || "",
    };
  } catch (e: any) {
    systemLogger.error("[TWILIO_CONFIG]", e?.message || e);
    return null;
  }
}

/**
 * Create a Twilio REST client for a given config.
 * Uses basic auth (AccountSid:AuthToken) against the Twilio REST API.
 * We avoid importing the heavy twilio npm package — just use fetch.
 */
export function twilioApiUrl(accountSid: string, path: string): string {
  return `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`;
}

export function twilioAuthHeader(accountSid: string, authToken: string): string {
  const encoded = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  return `Basic ${encoded}`;
}

export function isE164(num: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(num);
}
