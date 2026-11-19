import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { isPrivilegedSystemRole, sanitizeUser } from "@/lib/security/authz";
import { hashPassword, comparePassword } from "@/lib/password-utils";
import { systemLogger } from "@/lib/logger";

export async function PUT(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;

  if (!params.userId) {
    return new NextResponse("No user ID provided", { status: 400 });
  }

  const { password, cpassword, currentPassword } = await req.json();

  if (!password || !cpassword || typeof password !== "string" || typeof cpassword !== "string") {
    return new NextResponse("No password provided", { status: 400 });
  }

  if (password.length < 15 || password.length > 128) {
    return new NextResponse("Password must be between 15 and 128 characters", { status: 400 });
  }

  if (password !== cpassword) {
    return new NextResponse("Passwords do not match", { status: 400 });
  }

  if (session.user.email === "demo@basalthq.com") {
    return new NextResponse(
      "Demo account password cannot be changed.",
      { status: 400 }
    );
  }

  try {
    const targetUser = await prismadb.users.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        password: true,
        mustChangePassword: true,
        team_id: true,
        is_admin: true,
        team_role: true,
      },
    });

    if (!targetUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    const isSelf = session.user.id === params.userId;

    if (!isSelf) {
      const teamInfo = await getCurrentUserTeamId();
      if (!teamInfo?.isAdmin) {
        return new NextResponse("Forbidden: You can only change your own password", { status: 403 });
      }
      if (!validateResourceOwnership(teamInfo.teamId, targetUser.team_id, teamInfo.isPlatformAdmin)) {
        return await unauthorizedResponse("SET_PASSWORD", `Users:${params.userId}`);
      }
      if (
        !teamInfo.isPlatformAdmin &&
        (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
      ) {
        return new NextResponse("Forbidden: Cannot change password for a Platform Admin", { status: 403 });
      }
    } else if (currentPassword !== undefined && targetUser.password && !targetUser.mustChangePassword) {
      if (typeof currentPassword !== "string" || !(await comparePassword(currentPassword, targetUser.password))) {
        return new NextResponse("Current password is incorrect", { status: 400 });
      }
    }

    const newUserPass = await prismadb.users.update({
      data: {
        session_version: { increment: 1 },
        password: await hashPassword(password),
        mustChangePassword: false,
      },
      where: {
        id: params.userId,
      },
    });

    return NextResponse.json(sanitizeUser(newUserPass));
  } catch (error) {
    systemLogger.error("[NEW_USERPASS_PUT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
