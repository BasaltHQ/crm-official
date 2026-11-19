import { NextResponse } from "next/server";
import { createHash, randomUUID } from "crypto";
import { prismadb } from "@/lib/prisma";
import PasswordResetEmail from "@/emails/PasswordReset";
import { render } from "@react-email/render";
import sendEmail from "@/lib/sendmail";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body || {};

    if (!email || typeof email !== "string" || !email.trim()) {
      return new NextResponse("Email is required!", {
        status: 400,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await prismadb.users.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: "insensitive" },
      },
    });

    if (user && user.userStatus === "ACTIVE") {
      // Create a raw reset token and store ONLY its SHA-256 digest in DB
      const rawToken = randomUUID();
      const tokenUrlFriendly = Buffer.from(`${user.id}:${rawToken}`).toString("base64url");
      const tokenExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      const hashedToken = createHash("sha256").update(rawToken).digest("hex");

      // Do NOT increment session_version on unauthenticated reset request (prevents DoS logout)
      await prismadb.users.update({
        where: { id: user.id },
        data: {
          resetToken: hashedToken,
          resetTokenExpires: tokenExpires,
        },
      });

      try {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://crm.basalthq.com").replace(/\/+$/, "");
        const resetLink = `${appUrl}/reset-password/${tokenUrlFriendly}`;
        const emailHtml = await render(
          PasswordResetEmail({
            username: user.name || "User",
            avatar: user.avatar,
            email: user.email,
            resetLink: resetLink,
            userLanguage: "en",
          })
        );

        await sendEmail({
          to: user.email,
          subject: "BasaltCRM - Password reset",
          text: `Click here to reset your password: ${resetLink}`,
          html: emailHtml,
          replyTo: "support@basalthq.com",
        });
      } catch (e) {
        systemLogger.error("[USER_PASSWORD_CHANGE_EMAIL_ERROR]", e);
      }
    }

    // Always return success to prevent user enumeration
    return NextResponse.json({
      message: "If an account exists, a password reset link has been sent.",
      status: true,
    });
  } catch (error) {
    systemLogger.error("[USER_PASSWORD_CHANGE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
