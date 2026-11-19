import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { verifyWebAuthnRegistration, verifySignedWebAuthnChallenge } from "@/lib/mfa-utils";
import { prismadb } from "@/lib/prisma";

function clearRegChallengeCookie(res: NextResponse) {
    res.cookies.delete("webauthn_reg_challenge");
    res.cookies.set("webauthn_reg_challenge", "", {
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
        const session = await requireApiAuth();
        if (session instanceof NextResponse) return session;

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return clearRegChallengeCookie(
                NextResponse.json({ error: "User not found" }, { status: 404 })
            );
        }

        const cookieStore = await cookies();
        const challengeCookie = cookieStore.get("webauthn_reg_challenge")?.value;
        const verifiedChallenge = await verifySignedWebAuthnChallenge(
            challengeCookie,
            user.id,
            "register"
        );

        if (!verifiedChallenge) {
            return clearRegChallengeCookie(
                NextResponse.json({ error: "Invalid or expired registration challenge" }, { status: 400 })
            );
        }

        const { body } = await req.json();

        const verification = await verifyWebAuthnRegistration(body, verifiedChallenge);

        if (verification.verified && verification.authenticator) {
            const { authenticator } = verification;

            await prismadb.authenticator.create({
                data: {
                    credentialID: authenticator.credentialID,
                    publicKey: authenticator.publicKey,
                    counter: authenticator.counter,
                    transports: authenticator.transports,
                    userId: user.id,
                },
            });

            // Enable MFA — keep TOTP as default method if already configured
            const mfaMethodUpdate = user.mfaSecret ? "TOTP" : "WEBAUTHN";
            await prismadb.users.update({
                where: { id: user.id },
                data: {
                    session_version: { increment: 1 },
                    mfaEnabled: true,
                    mfaMethod: mfaMethodUpdate,
                },
            });

            return clearRegChallengeCookie(NextResponse.json({ success: true }));
        }

        return clearRegChallengeCookie(
            NextResponse.json({ error: "Verification failed" }, { status: 400 })
        );
    } catch (error: any) {
        console.error("[WebAuthn Register Verify Error]", error);
        return clearRegChallengeCookie(
            NextResponse.json(
                { error: "WebAuthn registration verification failed" },
                { status: 500 }
            )
        );
    }
}
