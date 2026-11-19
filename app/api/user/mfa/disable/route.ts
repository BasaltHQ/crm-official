import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { prismadb } from "@/lib/prisma";
import { verifyTotpToken } from "@/lib/mfa-utils";
import { comparePassword } from "@/lib/password-utils";
import { logActivityInternal } from "@/actions/audit";

export async function POST(req: Request) {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    let method = "all";
    let code: string | undefined;
    let password: string | undefined;
    let mfaToken: string | undefined;

    try {
        const body = await req.json();
        method = body?.method || "all";
        code = typeof body?.code === "string" ? body.code.trim() : undefined;
        password =
            typeof body?.password === "string"
                ? body.password
                : typeof body?.currentPassword === "string"
                    ? body.currentPassword
                    : undefined;
        mfaToken = typeof body?.mfaToken === "string" ? body.mfaToken : undefined;
    } catch {
        // Malformed or empty JSON body — rejected by step-up check below
    }

    const dbUser = await prismadb.users.findUnique({
        where: { id: session.user.id },
        include: { authenticators: true },
    });

    if (!dbUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Require step-up verification (current password, TOTP code, or verified WebAuthn mfaToken)
    let stepUpVerified = false;

    if (password && dbUser.password) {
        stepUpVerified = await comparePassword(password, dbUser.password);
    }

    if (!stepUpVerified && code && dbUser.mfaSecret) {
        stepUpVerified = await verifyTotpToken(code, dbUser.mfaSecret);
    }

    if (!stepUpVerified && mfaToken) {
        try {
            const jwtSec = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
            if (jwtSec) {
                const { payload } = await jwtVerify(mfaToken, new TextEncoder().encode(jwtSec));
                if (payload.sub === dbUser.id && payload.mfaVerified === true) {
                    stepUpVerified = true;
                }
            }
        } catch {
            stepUpVerified = false;
        }
    }

    if (!stepUpVerified) {
        return NextResponse.json(
            { error: "Step-up verification required. Please confirm with your current password or authenticator code." },
            { status: 403 }
        );
    }

    if (method === "totp") {
        // ── Reset TOTP only ──
        const authenticatorCount = await prismadb.authenticator.count({
            where: { userId: dbUser.id },
        });

        await (prismadb.users as any).update({
            where: { id: dbUser.id },
            data: {
                mfaSecret: null,
                ...(authenticatorCount > 0
                    ? { mfaMethod: "WEBAUTHN" }
                    : { mfaEnabled: false, mfaMethod: "NONE" }
                ),
            },
        });

        await logActivityInternal(
            dbUser.id, "MFA_TOTP_RESET", "Security",
            "User reset TOTP authenticator app configuration.",
            dbUser.team_id || undefined
        );
    } else if (method === "webauthn") {
        // ── Reset WebAuthn only ──
        await prismadb.authenticator.deleteMany({
            where: { userId: dbUser.id },
        });

        await (prismadb.users as any).update({
            where: { id: dbUser.id },
            data: {
                ...(dbUser.mfaSecret
                    ? { mfaMethod: "TOTP" }
                    : { mfaEnabled: false, mfaMethod: "NONE" }
                ),
            },
        });

        await logActivityInternal(
            dbUser.id, "MFA_WEBAUTHN_RESET", "Security",
            "User reset WebAuthn/Passkey configuration.",
            dbUser.team_id || undefined
        );
    } else {
        // ── Disable ALL MFA ──
        await prismadb.authenticator.deleteMany({
            where: { userId: dbUser.id },
        });

        const user = await (prismadb.users as any).update({
            where: { id: dbUser.id },
            data: {
                mfaEnabled: false,
                mfaMethod: "NONE",
                mfaSecret: null,
            },
        });

        await logActivityInternal(
            user.id, "MFA_DISABLED", "Security",
            "User voluntarily disabled Multi-Factor Authentication.",
            user.team_id || undefined
        );

        // SOC2 Critical Event Escalation Notification
        try {
            const sendEmail = (await import("@/lib/sendmail")).default;
            await sendEmail({
                to: user.email,
                subject: "Security Alert: Multi-Factor Authentication Disabled",
                text: `Multi-Factor Authentication (MFA) was just disabled on your account. If you did not perform this action, your account may be compromised. Please reset your password immediately.`,
                html: `
                    <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px;">
                        <h2 style="color: #dc2626; margin-top: 0;">Security Alert</h2>
                        <p>Multi-Factor Authentication (MFA) was just <strong>disabled</strong> on your account.</p>
                        <p>If you did not perform this action, your account may be compromised. Please reset your password immediately.</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.error("Failed to send SOC2 MFA escalation email:", emailError);
        }
    }

    return NextResponse.json({ success: true });
}
