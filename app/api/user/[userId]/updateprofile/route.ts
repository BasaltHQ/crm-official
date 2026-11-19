import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { isPrivilegedSystemRole, sanitizeUser } from "@/lib/security/authz";
import { systemLogger } from "@/lib/logger";

export async function PUT(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;

  if (!params.userId) {
    return new NextResponse("No user ID provided", { status: 400 });
  }

  const isSelf = session.user.id === params.userId;

  try {
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
        return await unauthorizedResponse("UPDATE_PROFILE", `Users:${params.userId}`);
      }
      if (
        !teamInfo.isPlatformAdmin &&
        (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
      ) {
        return new NextResponse("Forbidden: Cannot modify a Platform Admin", { status: 403 });
      }
    }

    const { name, username, account_name, lastKnownRegion } = await req.json();

    const updatedUser = await prismadb.users.update({
      data: {
        name: typeof name === "string" ? name : undefined,
        username: typeof username === "string" ? username : undefined,
        account_name: typeof account_name === "string" ? account_name : undefined,
        lastKnownRegion: typeof lastKnownRegion === "string" ? lastKnownRegion : undefined,
      },
      where: {
        id: params.userId,
      },
    });

    if (isSelf) {
      import("@/actions/quests/add-raw-xp")
        .then((m) =>
          m.grantOneTimeXP({
            userId: params.userId,
            xpAmount: 10,
            flagKey: "profile_completed",
            reason: "Completed User Profile",
          })
        )
        .catch((e) => systemLogger.warn(`[UPDATE_PROFILE] Failed to award XP: ${e?.message}`));

      import("@/actions/university/log-user-metric")
        .then((m) => m.logUserMetric("updated_timezone"))
        .catch((e) => systemLogger.warn(`[UPDATE_PROFILE] Failed to log user metric: ${e?.message}`));
    }

    return NextResponse.json(sanitizeUser(updatedUser));
  } catch (error) {
    systemLogger.error("[UPDATE_USER_PROFILE_PUT]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
