import {
    generateSecret,
    verify,
    generateURI,
    NobleCryptoPlugin,
    ScureBase32Plugin
} from "otplib";
import QRCode from "qrcode";
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { SignJWT, jwtVerify } from "jose";
import { prismadb } from "./prisma";
import { sendSmsEum } from "./aws/eum-sms";
import { decryptSecret } from "./encryption";

/**
 * MFA & NIST 800-63B Compliance Utilities
 */

const commonOptions = {
    createCrypto: () => new NobleCryptoPlugin(),
    createBase32: () => new ScureBase32Plugin(),
};

function getMfaJwtKey(): Uint8Array {
    const sec = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!sec) {
        throw new Error("[MFA] Missing JWT_SECRET / NEXTAUTH_SECRET");
    }
    return new TextEncoder().encode(sec);
}

// ─── Server-Signed WebAuthn Challenge Tokens ─────────────────────────────────

export async function signWebAuthnChallenge(
    userId: string,
    challenge: string,
    purpose: "register" | "authenticate"
): Promise<string> {
    return new SignJWT({ challenge, purpose })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime("5m")
        .sign(getMfaJwtKey());
}

export async function verifySignedWebAuthnChallenge(
    token: string | undefined | null,
    expectedUserId: string,
    expectedPurpose: "register" | "authenticate"
): Promise<string | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, getMfaJwtKey());
        if (payload.sub !== expectedUserId || payload.purpose !== expectedPurpose) {
            return null;
        }
        return typeof payload.challenge === "string" ? payload.challenge : null;
    } catch {
        return null;
    }
}

// ─── TOTP (QR Code / 6-Digit) ────────────────────────────────────────────────

export const generateTotpSecret = () => {
    return generateSecret({ ...commonOptions, length: 20 });
};

export const getTotpAuthUrl = (email: string, secret: string) => {
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "Basalt CRM";
    const rawSecret = decryptSecret(secret) || secret;
    return generateURI({
        ...commonOptions,
        issuer: appName,
        label: email,
        secret: rawSecret,
    });
};

export const generateQrCodeDataUrl = async (authUrl: string) => {
    return await QRCode.toDataURL(authUrl);
};

export const verifyTotpToken = async (token: string, secret: string) => {
    const rawSecret = decryptSecret(secret) || secret;
    const result = await verify({
        ...commonOptions,
        token,
        secret: rawSecret,
    });
    return result.valid;
};

// ─── SMS MFA ─────────────────────────────────────────────────────────────────

export const sendMfaSms = async (phone: string, code: string) => {
    const body = `Your ${process.env.NEXT_PUBLIC_APP_NAME || "Basalt CRM"} verification code is: ${code}. Valid for 5 minutes.`;
    return await sendSmsEum({
        to: phone,
        body,
        messageType: "TRANSACTIONAL",
    });
};

// ─── WebAuthn (Fingerprint / Biometrics) ─────────────────────────────────────

const rpName = process.env.NEXT_PUBLIC_APP_NAME || "Basalt CRM";
const origin = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const rpID = process.env.NEXT_PUBLIC_AUTH_DOMAIN || (() => {
    try { return new URL(origin).hostname; } catch { return "localhost"; }
})();

export const getWebAuthnRegistrationOptions = async (userId: string, email: string) => {
    const userBytes = Buffer.from(userId);

    const userAuthenticators = await (prismadb as any).authenticator.findMany({
        where: { userId },
    });

    return await generateRegistrationOptions({
        rpName,
        rpID,
        userID: userBytes,
        userName: email,
        attestationType: "none",
        excludeCredentials: userAuthenticators.map((auth: any) => ({
            id: auth.credentialID,
            transports: auth.transports as any,
        })),
        authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "preferred",
        },
    });
};

export const verifyWebAuthnRegistration = async (body: any, expectedChallenge: string) => {
    try {
        const challenge = typeof expectedChallenge === "string"
            ? expectedChallenge
            : expectedChallenge && (expectedChallenge as any).challenge;

        if (!challenge) {
            return { verified: false, error: "Missing server challenge" };
        }

        const verification: any = await verifyRegistrationResponse({
            response: body,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            requireUserVerification: false,
        });

        if (verification.verified && verification.registrationInfo) {
            const { credential } = verification.registrationInfo;

            return {
                verified: true,
                authenticator: {
                    credentialID: credential.id,
                    publicKey: Buffer.from(credential.publicKey).toString("base64url"),
                    counter: credential.counter,
                    transports: body.response?.transports || [],
                },
            };
        }

        return { verified: false };
    } catch (error: any) {
        console.error("[WebAuthn Registration Error]", error.message);
        return { verified: false, error: error.message };
    }
};

export const getWebAuthnAuthenticationOptions = async (userId: string) => {
    const userAuthenticators = await (prismadb as any).authenticator.findMany({
        where: { userId },
    });

    return await generateAuthenticationOptions({
        rpID,
        allowCredentials: userAuthenticators.map((auth: any) => ({
            id: auth.credentialID,
            transports: auth.transports as any,
        })),
        userVerification: "preferred",
    });
};

export const verifyWebAuthnAuthentication = async (body: any, expectedChallenge: string, auth: any) => {
    try {
        const challenge = typeof expectedChallenge === "string"
            ? expectedChallenge
            : expectedChallenge && (expectedChallenge as any).challenge;

        if (!challenge) {
            return { verified: false, error: "Missing server challenge" };
        }

        const verification: any = await verifyAuthenticationResponse({
            response: body,
            expectedChallenge: challenge,
            expectedOrigin: origin,
            expectedRPID: rpID,
            credential: {
                id: auth.credentialID,
                publicKey: new Uint8Array(Buffer.from(auth.publicKey, "base64url")),
                counter: auth.counter,
                transports: auth.transports,
            },
            requireUserVerification: false,
        });

        return verification;
    } catch (error: any) {
        console.error("[WebAuthn Authentication Error]", error.message);
        return { verified: false, error: error.message };
    }
};
