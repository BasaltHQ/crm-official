import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { encryptSecret } from "@/lib/encryption";
import { logActivityInternal } from "@/actions/audit";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { isPrivilegedSystemRole } from "@/lib/security/authz";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request, props: { params: Promise<{ userId: string }> }) {
  const params = await props.params;
  const session = await requireApiAuth();
  if (session instanceof NextResponse) return session;

  const userId = params.userId;
  if (!userId) {
    return new NextResponse("userId is required", { status: 400 });
  }

  const isSelf = session.user.id === userId;
  const teamInfo = await getCurrentUserTeamId();

  if (!isSelf) {
    if (!teamInfo?.isAdmin) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const targetUser = await prismadb.users.findUnique({
      where: { id: userId },
      select: { id: true, team_id: true, is_admin: true, team_role: true },
    });
    if (!targetUser) {
      return new NextResponse("User not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo.teamId, targetUser.team_id, teamInfo.isPlatformAdmin)) {
      return await unauthorizedResponse("SET_OPENAI_KEY", `Users:${userId}`);
    }
    if (
      !teamInfo.isPlatformAdmin &&
      (targetUser.is_admin || isPrivilegedSystemRole(targetUser.team_role))
    ) {
      return new NextResponse("Forbidden: Cannot modify a Platform Admin", { status: 403 });
    }
  }

  const { organizationId, secretKey } = await req.json();

  if (!organizationId || !secretKey || typeof organizationId !== "string" || typeof secretKey !== "string") {
    return new NextResponse("Missing organizationId or secretKey", {
      status: 400,
    });
  }

  try {
    const encryptedKey = encryptSecret(secretKey) || "";
    const checkIfExist = await prismadb.openAi_keys.findFirst({
      where: {
        user: userId,
      },
    });

    if (checkIfExist !== null) {
      const updated = await prismadb.openAi_keys.update({
        where: {
          id: checkIfExist.id,
        },
        data: {
          api_key: encryptedKey,
          organization_id: organizationId,
        },
      });
      await logActivityInternal(
        session.user.id,
        "UPDATE",
        "openAi_keys",
        `Updated OpenAI key for user ${userId}`,
        teamInfo?.teamId || undefined
      );
      return NextResponse.json({ ...updated, api_key: "********" }, { status: 200 });
    } else {
      const created = await prismadb.openAi_keys.create({
        data: {
          v: 0,
          api_key: encryptedKey,
          organization_id: organizationId,
          user: userId,
        },
      });

      await logActivityInternal(
        session.user.id,
        "CREATE",
        "openAi_keys",
        `Created OpenAI key for user ${userId}`,
        teamInfo?.teamId || undefined
      );
      return NextResponse.json({ ...created, api_key: "********" }, { status: 200 });
    }
  } catch (error) {
    systemLogger.error("[USER_UPDATE_OPENAIKEY]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
