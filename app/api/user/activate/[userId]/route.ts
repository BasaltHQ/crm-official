import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { sanitizeUser } from "@/lib/security/authz";
import sendEmail from "@/lib/sendmail";
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
      include: {
        assigned_team: {
          select: { id: true, status: true },
        },
      },
    });

    if (!targetUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, targetUser.team_id, teamInfo!.isPlatformAdmin)) {
      return await unauthorizedResponse("ACTIVATE", `Users:${params.userId}`);
    }

    // Prevent non-Platform-Admins from activating users while team is PENDING (unpaid)
    if (!teamInfo!.isPlatformAdmin) {
      const targetTeamStatus =
        targetUser.assigned_team?.status ||
        (teamInfo!.teamId
          ? (await prismadb.team.findUnique({
              where: { id: teamInfo!.teamId },
              select: { status: true },
            }))?.status
          : null);

      if (targetTeamStatus === "PENDING") {
        return new NextResponse(
          "Forbidden: Cannot activate users while team subscription is pending",
          { status: 403 }
        );
      }
    }

    const user = await prismadb.users.update({
      where: {
        id: params.userId,
      },
      data: {
        userStatus: "ACTIVE",
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm.basalthq.com";
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "BasaltCRM";
    const message = `Your account has been activated in ${appName} \n\n Your username is: ${user.email} \n\n Please login to ${appUrl} \n\n Thank you \n\n ${appName}`;

    await sendEmail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: `Invitation to ${appName}`,
      text: message,
    });

    return NextResponse.json(sanitizeUser(user));
  } catch (error) {
    systemLogger.error("[USER_ACTIVATE_POST]", error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
