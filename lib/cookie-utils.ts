import { SignJWT, jwtVerify } from "jose";

function getSigningKey(): Uint8Array {
    const sec = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    if (!sec) {
        throw new Error("[SECURITY] Missing NEXTAUTH_SECRET / JWT_SECRET for signed cookies");
    }
    return new TextEncoder().encode(sec);
}

export async function signImpersonatedTeamId(
    teamId: string,
    actorUserId?: string
): Promise<string> {
    const jwt = new SignJWT({ teamId, ...(actorUserId ? { actorUserId } : {}) })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("8h");

    if (actorUserId) {
        jwt.setSubject(actorUserId);
    }

    return jwt.sign(getSigningKey());
}

export async function verifyImpersonatedTeamId(
    token: string,
    expectedUserId?: string
): Promise<string | null> {
    try {
        const { payload } = await jwtVerify(token, getSigningKey());
        const actor = (payload.sub || payload.actorUserId) as string | undefined;
        // Reject unbound or mismatched impersonation cookies when caller userId is known
        if (expectedUserId && (!actor || actor !== expectedUserId)) {
            return null;
        }
        return typeof payload.teamId === "string" ? payload.teamId : null;
    } catch {
        return null;
    }
}
