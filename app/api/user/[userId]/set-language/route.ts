import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { isPrivilegedSystemRole } from "@/lib/security/authz";
import { systemLogger } from "@/lib/logger";

export async function PUT(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;

  if (!params.userId) {
    return new NextResponse("No user ID provided", { status: 400 });
  }

  const isSelf = session.user.id === params.userId;
  if (!isSelf) {
    const teamInfo = await getCurrentUserTeamId();
    if (!teamInfo?.isAdmin) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const targetUser = await prismadb.users.findUnique({
      where: { id: params.userId },
      select: { id: true, team_id: true, is_admin: true, team_role: true },
    });
    if (!targetUser) {
      return new NextResponse("User not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo.teamId, targetUser.team_id, teamInfo.isPlatformAdmin)) {
      return await unauthorizedResponse("SET_LANGUAGE", `Users:${params.userId}`);
    }
    if (
      !teamInfo.isPlatformAdmin &&
      (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
    ) {
      return new NextResponse("Forbidden: Cannot modify a Platform Admin", { status: 403 });
    }
  }

  const { language } = await req.json();

  if (!language || typeof language !== "string" || !/^[a-zA-Z-]{2,10}$/.test(language)) {
    return new NextResponse("Invalid language provided", { status: 400 });
  }

  try {
    await prismadb.users.update({
      data: {
        userLanguage: language,
      },
      where: {
        id: params.userId,
      },
    });

    return NextResponse.json({ language }, { status: 200 });
  } catch (error) {
    systemLogger.error("[NEWUSER_LANG_PUT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
