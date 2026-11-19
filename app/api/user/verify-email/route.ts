import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { prismadb } from "@/lib/prisma";
import { verifyEmailIdentity, getIdentityVerificationStatus } from "@/lib/aws/ses-verify";
import { systemLogger } from "@/lib/logger";

/**
 * GET /api/user/verify-email
 * Checks the current SES verification status for the logged-in user's email.
 * If verified, updates the user record and returns { verified: true }.
 */
export async function GET() {
    try {
        const session = await requireApiAuth();
        if (session instanceof NextResponse) return session;

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: { email: true, sesEmailVerified: true }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // Already verified — skip SES check
        if (user.sesEmailVerified) {
            return NextResponse.json({ verified: true, email: user.email });
        }

        // Check SES verification status
        const status = await getIdentityVerificationStatus(user.email);

        if (status === "SUCCESS") {
            // Mark user as SES-verified
            await prismadb.users.update({
                where: { id: session.user.id },
                data: { sesEmailVerified: true }
            });

            import("@/actions/quests/add-raw-xp")
              .then((m) => m.grantOneTimeXP({
                  userId: session.user.id,
                  xpAmount: 10,
                  flagKey: "email_verified",
                  reason: "Verified Work Email"
              }))
              .catch((e) => systemLogger.warn(`[VERIFY_EMAIL] Failed to award XP: ${e?.message}`));

            systemLogger.info(`[SES_USER_VERIFY] Email verified for user ${session.user.id} (${user.email})`);
            return NextResponse.json({ verified: true, email: user.email });
        }

        return NextResponse.json({
            verified: false,
            email: user.email,
            status: status // PENDING, NOT_STARTED, FAILED
        });
    } catch (error) {
        systemLogger.error("[VERIFY_EMAIL_GET]", error);
        return NextResponse.json({ error: "Failed to check verification status" }, { status: 500 });
    }
}

/**
 * POST /api/user/verify-email
 * Triggers or re-triggers SES email identity verification for the logged-in user.
 */
export async function POST() {
    try {
        const session = await requireApiAuth();
        if (session instanceof NextResponse) return session;

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: { email: true, sesEmailVerified: true }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (user.sesEmailVerified) {
            return NextResponse.json({ message: "Email already verified", verified: true });
        }

        // Trigger SES verification with force-resend (delete + recreate to actually send the email)
        await verifyEmailIdentity(user.email, undefined, true);

        systemLogger.info(`[SES_USER_VERIFY] Verification triggered for user ${session.user.id} (${user.email})`);
        return NextResponse.json({
            message: "Verification email sent. Please check your inbox and click the verification link.",
            email: user.email
        });
    } catch (error) {
        systemLogger.error("[VERIFY_EMAIL_POST]", error);
        return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
    }
}

/**
 * PUT /api/user/verify-email
 * Platform admin skip — marks email as verified without SES check.
 */
export async function PUT() {
    try {
        const session = await requireApiAuth();
        if (session instanceof NextResponse) return session;

        const admin = await requirePlatformAdmin();
        if (!admin) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prismadb.users.update({
            where: { id: admin.id },
            data: { sesEmailVerified: true }
        });

        systemLogger.info(`[SES_USER_VERIFY] Email verification skipped by platform admin ${admin.id}`);
        return NextResponse.json({ skipped: true });
    } catch (error) {
        systemLogger.error("[VERIFY_EMAIL_PUT]", error);
        return NextResponse.json({ error: "Failed to skip verification" }, { status: 500 });
    }
}
