import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { getWebAuthnRegistrationOptions, signWebAuthnChallenge } from "@/lib/mfa-utils";
import { prismadb } from "@/lib/prisma";

export async function GET() {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const user = await prismadb.users.findUnique({
        where: { id: session.user.id },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const options = await getWebAuthnRegistrationOptions(user.id, user.email);
    const signedChallenge = await signWebAuthnChallenge(
        user.id,
        options.challenge,
        "register"
    );

    const res = NextResponse.json(options);
    res.cookies.set("webauthn_reg_challenge", signedChallenge, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 300,
    });

    return res;
}
