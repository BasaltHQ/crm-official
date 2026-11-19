import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prismadb } from "@/lib/prisma";
import { verifyWebAuthnAuthentication, verifySignedWebAuthnChallenge } from "@/lib/mfa-utils";
import { SignJWT } from "jose";

function clearChallengeCookie(res: NextResponse) {
    res.cookies.delete("webauthn_auth_challenge");
    res.cookies.set("webauthn_auth_challenge", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
    });
    return res;
}

export async function POST(req: Request) {
    try {
        const { body, email } = await req.json();
        const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

        if (!normalizedEmail || !body?.id) {
            return clearChallengeCookie(
                NextResponse.json({ error: "Invalid authentication request" }, { status: 400 })
            );
        }

        const cookieStore = await cookies();
        const challengeCookie = cookieStore.get("webauthn_auth_challenge")?.value;
        if (!challengeCookie) {
            return clearChallengeCookie(
                NextResponse.json({ error: "Missing or expired authentication challenge" }, { status: 400 })
            );
        }

        const user = await prismadb.users.findFirst({
            where: { email: { equals: normalizedEmail, mode: "insensitive" } },
            include: { authenticators: true },
        });

        if (!user || user.userStatus !== "ACTIVE" || !user.authenticators || user.authenticators.length === 0) {
            return clearChallengeCookie(
                NextResponse.json({ error: "WebAuthn verification failed" }, { status: 400 })
            );
        }

        const verifiedChallenge = await verifySignedWebAuthnChallenge(
            challengeCookie,
            user.id,
            "authenticate"
        );

        if (!verifiedChallenge) {
            return clearChallengeCookie(
                NextResponse.json({ error: "Invalid or expired authentication challenge" }, { status: 400 })
            );
        }

        const authenticator = (user.authenticators as any[]).find(
            (a) => a.credentialID === body.id
        );

        if (!authenticator) {
            return clearChallengeCookie(
                NextResponse.json({ error: "WebAuthn verification failed" }, { status: 400 })
            );
        }

        const verification = await verifyWebAuthnAuthentication(body, verifiedChallenge, authenticator);

        if (verification.verified) {
            await prismadb.authenticator.update({
                where: { id: authenticator.id },
                data: { counter: verification.authenticationInfo.newCounter },
            });

            const jwtSec = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
            if (!jwtSec) throw new Error("Critical: JWT_SECRET / NEXTAUTH_SECRET is not set");
            const secret = new TextEncoder().encode(jwtSec);
            const mfaToken = await new SignJWT({ sub: user.id, mfaVerified: true })
                .setProtectedHeader({ alg: "HS256" })
                .setIssuedAt()
                .setExpirationTime("2m")
                .sign(secret);

            return clearChallengeCookie(NextResponse.json({ success: true, mfaToken }));
        }

        return clearChallengeCookie(
            NextResponse.json({ error: "WebAuthn verification failed" }, { status: 400 })
        );
    } catch (error) {
        console.error("[WebAuthn Auth Verify Error]", error);
        return clearChallengeCookie(
            NextResponse.json({ error: "WebAuthn verification failed" }, { status: 500 })
        );
    }
}
