import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { prismadb } from "@/lib/prisma";
import { verifyTotpToken } from "@/lib/mfa-utils";
import { encryptSecret } from "@/lib/encryption";
import { comparePassword } from "@/lib/password-utils";

export async function POST(req: Request) {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const { code, secret, currentCode, currentPassword } = await req.json();

    if (!code || !secret || typeof code !== "string" || typeof secret !== "string") {
        return NextResponse.json({ error: "Missing code or secret" }, { status: 400 });
    }

    const user = await prismadb.users.findUnique({
        where: { id: session.user.id },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prevent silent TOTP overwrite when MFA + existing mfaSecret are already active
    if (user.mfaEnabled && user.mfaSecret) {
        let stepUpOk = false;
        if (currentCode && typeof currentCode === "string") {
            stepUpOk = await verifyTotpToken(currentCode, user.mfaSecret);
        }
        if (!stepUpOk && currentPassword && typeof currentPassword === "string" && user.password) {
            stepUpOk = await comparePassword(currentPassword, user.password);
        }
        if (!stepUpOk) {
            return NextResponse.json(
                { error: "TOTP is already enabled. Provide currentCode or currentPassword to replace your authenticator secret." },
                { status: 403 }
            );
        }
    }

    const isValid = await verifyTotpToken(code, secret);

    if (!isValid) {
        return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
    }

    const encryptedSecret = encryptSecret(secret);

    await prismadb.users.update({
        where: { id: user.id },
        data: {
            mfaEnabled: true,
            mfaMethod: "TOTP",
            mfaSecret: encryptedSecret,
        },
    });

    return NextResponse.json({ success: true });
}
