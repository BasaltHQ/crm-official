import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { isPrivilegedSystemRole, sanitizeUser } from "@/lib/security/authz";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  if (!teamInfo!.isAdmin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const targetUser = await prismadb.users.findUnique({
      where: { id: params.userId },
      select: { id: true, team_id: true, is_admin: true, team_role: true },
    });

    if (!targetUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, targetUser.team_id, teamInfo!.isPlatformAdmin)) {
      return await unauthorizedResponse("DEACTIVATE", `Users:${params.userId}`);
    }

    if (
      !teamInfo!.isPlatformAdmin &&
      (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
    ) {
      return new NextResponse("Forbidden: Cannot deactivate a Platform Admin", { status: 403 });
    }

    const user = await prismadb.users.update({
      where: {
        id: params.userId,
      },
      data: {
        session_version: { increment: 1 },
        userStatus: "INACTIVE",
      },
    });

    return NextResponse.json(sanitizeUser(user));
  } catch (error) {
    systemLogger.error("[USER_DEACTIVATE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
