import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { isPrivilegedSystemRole, sanitizeUser } from "@/lib/security/authz";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

export async function GET(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const { error, session, teamInfo } = await getSessionAndTeam();

  const isSelf = Boolean(
    session?.user?.id &&
    (session as any).error !== "SessionInvalidated" &&
    session.user.userStatus === "ACTIVE" &&
    session.user.id === params.userId
  );

  if (error && !isSelf) {
    return error;
  }

  if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  try {
    const users = await prismadb.users.findMany({
      where: {
        id: params.userId,
      },
    });

    if (!isSelf) {
      const target = users[0];
      if (!target) {
        return NextResponse.json([]);
      }
      if (!validateResourceOwnership(teamInfo!.teamId, target.team_id, teamInfo!.isPlatformAdmin)) {
        return await unauthorizedResponse("READ", `Users:${params.userId}`);
      }
    }

    return NextResponse.json(sanitizeUser(users));
  } catch (error) {
    systemLogger.error("[USER_GET]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

export async function DELETE(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const { error, teamInfo, session } = await getSessionAndTeam();

  const isDeletingSelf = Boolean(
    session?.user?.id &&
    (session as any).error !== "SessionInvalidated" &&
    session.user.userStatus === "ACTIVE" &&
    session.user.id === params.userId
  );

  if (error && !isDeletingSelf) {
    return error;
  }

  if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  try {
    const targetUser = await prismadb.users.findUnique({
      where: { id: params.userId },
      select: { id: true, email: true, name: true, team_id: true, is_admin: true, team_role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!isDeletingSelf) {
      if (!teamInfo?.isAdmin) {
        return await unauthorizedResponse("DELETE", `Users:${params.userId}`);
      }
      if (!validateResourceOwnership(teamInfo.teamId, targetUser.team_id, teamInfo.isPlatformAdmin)) {
        return await unauthorizedResponse("DELETE", `Users:${params.userId}`);
      }
      if (
        !teamInfo.isPlatformAdmin &&
        (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
      ) {
        return new NextResponse("Forbidden: Cannot delete a Platform Admin", { status: 403 });
      }
    }

    await prismadb.projectMember.deleteMany({ where: { user: params.userId } });
    await (prismadb as any).systemActivity.deleteMany({ where: { userId: params.userId } });
    await prismadb.notification.deleteMany({ where: { userId: params.userId } });
    await prismadb.dashboardPreference.deleteMany({ where: { userId: params.userId } });
    await (prismadb as any).authenticator.deleteMany({ where: { userId: params.userId } });

    const user = await prismadb.users.delete({
      where: {
        id: params.userId,
      },
      select: { email: true, name: true, team_id: true },
    });

    await logActivityInternal(
      session.user.id,
      "RECORD_DELETE",
      "Users",
      `Deleted user account: ${user.email} (${user.name})`,
      teamInfo?.teamId || undefined
    );

    return NextResponse.json({ success: true, message: "User purged" });
  } catch (error) {
    systemLogger.error("[USER_DELETE]", error);
    return NextResponse.json({ error: "Failed to purge user" }, { status: 500 });
  }
}
