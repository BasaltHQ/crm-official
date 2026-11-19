import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getWebAuthnAuthenticationOptions, signWebAuthnChallenge } from "@/lib/mfa-utils";

const DUMMY_USER_ID = "000000000000000000000000";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

        if (!email) {
            return NextResponse.json({ error: "Email required" }, { status: 400 });
        }

        const user = await prismadb.users.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { id: true, mfaEnabled: true, userStatus: true },
        });

        // Avoid leaking whether an arbitrary email exists or has MFA enabled
        const targetUserId =
            user && user.mfaEnabled && user.userStatus === "ACTIVE"
                ? user.id
                : DUMMY_USER_ID;

        const options = await getWebAuthnAuthenticationOptions(targetUserId);
        const signedChallenge = await signWebAuthnChallenge(
            targetUserId,
            options.challenge,
            "authenticate"
        );

        const res = NextResponse.json(options);
        res.cookies.set("webauthn_auth_challenge", signedChallenge, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 300,
        });

        return res;
    } catch (error) {
        console.error("[WebAuthn Auth Options Error]", error);
        return NextResponse.json({ error: "Failed to generate authentication options" }, { status: 500 });
    }
}
