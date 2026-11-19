import crypto from "crypto";

/**
 * AWS SNS HTTP/HTTPS Webhook Cryptographic Signature Verification.
 * Prevents forged Notification / SubscriptionConfirmation events and SSRF via SigningCertURL / SubscribeURL.
 */

const SNS_HOST_REGEX = /^sns\.[a-z0-9-]+\.amazonaws\.com$/i;
const CERT_CACHE = new Map<string, { pem: string; expiresAt: number }>();
const CERT_TTL_MS = 60 * 60 * 1000; // 1 hour

export function isValidAwsSnsUrl(rawUrl: unknown, requirePemPath = false): boolean {
    if (typeof rawUrl !== "string" || !rawUrl) return false;
    try {
        const u = new URL(rawUrl);
        if (u.protocol !== "https:") return false;
        if (!SNS_HOST_REGEX.test(u.hostname)) return false;
        if (requirePemPath && (!u.pathname.endsWith(".pem") || u.pathname.includes(".."))) {
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

async function fetchSnsCertificate(certUrl: string): Promise<string> {
    if (!isValidAwsSnsUrl(certUrl, true)) {
        throw new Error("Untrusted SNS SigningCertURL");
    }

    const cached = CERT_CACHE.get(certUrl);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.pem;
    }

    const res = await fetch(certUrl, { redirect: "error" });
    if (!res.ok) {
        throw new Error(`Failed to fetch SNS signing certificate (${res.status})`);
    }

    const pem = await res.text();
    if (!pem.includes("-----BEGIN CERTIFICATE-----")) {
        throw new Error("Invalid SNS certificate payload");
    }

    CERT_CACHE.set(certUrl, { pem, expiresAt: Date.now() + CERT_TTL_MS });
    return pem;
}

function buildStringToSign(msg: Record<string, any>): string {
    const type = msg.Type;
    const fields =
        type === "Notification"
            ? ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"]
            : [
                  "Message",
                  "MessageId",
                  "SubscribeURL",
                  "Timestamp",
                  "Token",
                  "TopicArn",
                  "Type",
              ];

    const lines: string[] = [];
    for (const field of fields) {
        if (msg[field] !== undefined && msg[field] !== null) {
            lines.push(field);
            lines.push(String(msg[field]));
        }
    }
    return lines.join("\n") + "\n";
}

export async function verifySnsPayload(msg: Record<string, any>): Promise<boolean> {
    if (!msg || typeof msg !== "object") return false;
    const { Type, SignatureVersion, Signature, SigningCertURL } = msg;

    if (
        !["Notification", "SubscriptionConfirmation", "UnsubscribeConfirmation"].includes(Type) ||
        typeof Signature !== "string" ||
        typeof SigningCertURL !== "string"
    ) {
        return false;
    }

    let algorithm: string;
    if (SignatureVersion === "1") {
        algorithm = "RSA-SHA1";
    } else if (SignatureVersion === "2") {
        algorithm = "RSA-SHA256";
    } else {
        return false;
    }

    const pem = await fetchSnsCertificate(SigningCertURL);
    const stringToSign = buildStringToSign(msg);

    const verifier = crypto.createVerify(algorithm);
    verifier.update(stringToSign, "utf8");
    verifier.end();

    return verifier.verify(pem, Signature, "base64");
}

export async function verifyAndConfirmSnsRequest(rawBody: string): Promise<{
    valid: boolean;
    confirmed?: boolean;
    payload?: Record<string, any>;
    error?: string;
}> {
    let payload: Record<string, any>;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return { valid: false, error: "Invalid JSON" };
    }

    try {
        const isValid = await verifySnsPayload(payload);
        if (!isValid) {
            return { valid: false, error: "Invalid SNS signature" };
        }
    } catch (err: any) {
        return { valid: false, error: err?.message || "SNS signature verification failed" };
    }

    if (payload.Type === "SubscriptionConfirmation") {
        if (!isValidAwsSnsUrl(payload.SubscribeURL, false)) {
            return { valid: false, error: "Untrusted SubscribeURL" };
        }
        const confirmRes = await fetch(payload.SubscribeURL, {
            method: "GET",
            cache: "no-store",
            redirect: "error",
        });
        if (!confirmRes.ok) {
            return { valid: false, error: "SNS subscription confirmation failed" };
        }
        return { valid: true, confirmed: true, payload };
    }

    return { valid: true, confirmed: false, payload };
}

