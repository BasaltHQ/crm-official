import { hash as bcryptHash, compare as bcryptCompare } from "bcryptjs";
import { createHash } from "crypto";

function preHash(password: string): string {
    return createHash("sha256").update(password).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
    if (!password || password.length > 256) {
        throw new Error("Invalid password length");
    }
    const hashedForBcrypt = preHash(password);
    return await bcryptHash(hashedForBcrypt, 12);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
    if (!password || !hashed || password.length > 256) {
        return false;
    }
    // 1. Try NIST 2026 format (Pre-hashed SHA-256 + Bcrypt)
    const hashedForBcrypt = preHash(password);
    const ok = await bcryptCompare(hashedForBcrypt, hashed);
    if (ok) return true;

    // 2. Fallback to legacy direct Bcrypt (capped to 72 bytes per bcrypt spec)
    return await bcryptCompare(password.slice(0, 72), hashed);
}
