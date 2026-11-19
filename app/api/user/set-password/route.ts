import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { prismadb } from "@/lib/prisma";
import { hashPassword, comparePassword } from "@/lib/password-utils";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;

  let body: { newPassword?: string; currentPassword?: string | null };
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const newPassword = body?.newPassword?.trim();
  const currentPassword = body?.currentPassword?.trim() || null;

  // NIST 800-63B Alignment: Length over complexity.
  if (!newPassword || newPassword.length < 8) {
    return new NextResponse(
      "Password must be at least 8 characters long. We recommend a long passphrase.",
      { status: 400 }
    );
  }
  if (newPassword.length > 128) {
    return new NextResponse("Password too long (max 128 characters).", { status: 400 });
  }

  try {
    const user = await prismadb.users.findFirst({
      where: { id: session.user.id },
    });

    if (!user) {
      return new NextResponse("User not found.", { status: 404 });
    }

    // If user already has a password, require currentPassword validation.
    // Exception: if mustChangePassword is set, the user is in the forced temp-password
    // change flow and is already authenticated — skip the current password check.
    if (user.password && !user.mustChangePassword) {
      if (!currentPassword) {
        return new NextResponse("Current password is required.", { status: 400 });
      }
      const ok = await comparePassword(currentPassword, user.password);
      if (!ok) {
        return new NextResponse("Current password is incorrect.", { status: 400 });
      }
    }

    // Hash and set new password
    const hashed = await hashPassword(newPassword);
    await prismadb.users.update({
      where: { id: user.id },
      data: {
        session_version: { increment: 1 },
        password: hashed,
        mustChangePassword: false
      },
    });

    return NextResponse.json({ status: true, message: "Password updated." }, { status: 200 });
  } catch (error) {
    systemLogger.error("[USER_SET_PASSWORD_POST]", error);
    return new NextResponse("Failed to update password.", { status: 500 });
  }
}
