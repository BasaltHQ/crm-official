import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { NextResponse } from "next/server";

export async function POST(req: Request, props: { params: Promise<{ accountId: string }> }) {
  const params = await props.params;
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  if (!params.accountId) {
    return new NextResponse("Missing account ID", { status: 400 });
  }

  const accountId = params.accountId;

  try {
    const account = await prismadb.crm_Accounts.findUnique({
      where: { id: accountId },
      select: { id: true, team_id: true },
    });
    if (!account) {
      return new NextResponse("Account not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo!.teamId, account.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await prismadb.crm_Accounts.update({
      where: {
        id: accountId,
      },
      data: {
        watching_users: {
          connect: {
            id: session!.user.id,
          },
        },
      },
    });
    return NextResponse.json({ message: "Account watched" }, { status: 200 });
  } catch (error) {
    console.log(error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
