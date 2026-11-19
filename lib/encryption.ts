/**
 * SOC2 CC6.1 / CC6.7 — Field-Level Encryption for Secrets at Rest
 *
 * Uses AES-256-GCM (authenticated encryption) with a master key from env.
 * Every encrypted value gets a unique IV, and the auth tag prevents tampering.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const ENCODING = "hex" as const;
const PREFIX = "aes256gcm"; // Prefix to identify encrypted values
export const MASKED_SECRET_VALUE = "********";

function getMasterKey(): Buffer {
    const key = process.env.ENCRYPTION_MASTER_KEY;
    if (key) {
        if (key.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(key)) {
            throw new Error(
                `[ENCRYPTION] ENCRYPTION_MASTER_KEY must be 64 hex characters (32 bytes). Got ${key.length} chars.`
            );
        }
        return Buffer.from(key, "hex");
    }

    // Fallback derivation ONLY when ENCRYPTION_MASTER_KEY is unset in local environments
    const fallbackSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    if (fallbackSecret && process.env.NODE_ENV !== "production") {
        return createHash("sha256").update(`basaltcrm-field-key:${fallbackSecret}`).digest();
    }

    throw new Error(
        "[ENCRYPTION] ENCRYPTION_MASTER_KEY is not set. " +
            'Generate one: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
}

export function encryptSecret(plaintext: string | null | undefined): string | null {
    if (plaintext == null || plaintext === "") return null;
    if (plaintext === MASKED_SECRET_VALUE) {
        throw new Error("[ENCRYPTION] Refusing to encrypt masked placeholder value");
    }
    if (isEncrypted(plaintext)) return plaintext;

    const key = getMasterKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plaintext, "utf8", ENCODING);
    encrypted += cipher.final(ENCODING);

    const authTag = cipher.getAuthTag().toString(ENCODING);
    return `${PREFIX}:${iv.toString(ENCODING)}:${authTag}:${encrypted}`;
}

export function decryptSecret(ciphertext: string | null | undefined): string | null {
    if (ciphertext == null || ciphertext === "") return null;
    if (!isEncrypted(ciphertext)) return ciphertext;

    const key = getMasterKey();
    const parts = ciphertext.split(":");

    if (parts.length !== 4) {
        throw new Error("[ENCRYPTION] Malformed encrypted value — expected 4 parts separated by ':'");
    }

    const [, ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, ENCODING);
    const authTag = Buffer.from(authTagHex, ENCODING);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, ENCODING, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
}

export function isEncrypted(value: string | null | undefined): boolean {
    if (!value) return false;
    return value.startsWith(`${PREFIX}:`);
}

export function isMaskedSecret(value: unknown): boolean {
    return typeof value === "string" && (value === MASKED_SECRET_VALUE || /^\*{6,}$/.test(value.trim()));
}

export function maskSecretValue(value: string | null | undefined): string | null {
    return value && value.length > 0 ? MASKED_SECRET_VALUE : null;
}

export function maskFields<T extends Record<string, any> | null | undefined>(
    data: T,
    fieldNames: string[]
): T {
    if (!data || typeof data !== "object") return data;
    const result: Record<string, any> = { ...data };
    for (const field of fieldNames) {
        if (typeof result[field] === "string" && result[field].length > 0) {
            result[field] = MASKED_SECRET_VALUE;
        }
    }
    return result as T;
}

export function encryptFields<T extends Record<string, any>>(
    data: T,
    fieldNames: (keyof T)[]
): T {
    const result = { ...data };
    for (const field of fieldNames) {
        const value = result[field];
        if (typeof value === "string" && value !== "" && !isMaskedSecret(value)) {
            (result as any)[field] = encryptSecret(value);
        }
    }
    return result;
}

export function decryptFields<T extends Record<string, any>>(
    data: T,
    fieldNames: (keyof T)[]
): T {
    const result = { ...data };
    for (const field of fieldNames) {
        const value = result[field];
        if (typeof value === "string" && value !== "") {
            (result as any)[field] = decryptSecret(value);
        }
    }
    return result;
}

export const SECRET_FIELDS: Record<string, string[]> = {
    TeamEmailConfig: [
        "aws_secret_access_key",
        "resend_api_key",
        "sendgrid_api_key",
        "mailgun_api_key",
        "postmark_api_token",
        "smtp_password",
    ],
    TeamAiConfig: ["apiKey"],
    SystemAiConfig: ["apiKey"],
    Tenant_Integrations: [
        "surge_api_key",
        "shopify_access_token",
        "woocommerce_consumer_key",
        "woocommerce_consumer_secret",
        "mercury_api_key",
        "twilio_auth_token",
        "elevenlabs_api_key",
        "pandadoc_token",
        "discord_webhook",
    ],
    TeamCaptchaConfig: ["secret_key"],
    Users: ["mfaSecret"],
    openAi_keys: ["api_key"],
    gmail_Tokens: ["access_token", "refresh_token"],
    microsoft_Tokens: ["access_token", "refresh_token"],
    systemServices: ["serviceKey", "servicePassword"],
    crm_Emails: ["body_html", "body_text"],
};
