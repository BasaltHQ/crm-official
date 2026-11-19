import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { NextResponse } from "next/server";

//Route to unlink contact from opportunity
export async function PUT(req: Request, props: { params: Promise<{ contactId: string }> }) {
  const params = await props.params;
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  if (!params.contactId) {
    return new NextResponse("contact ID is required", { status: 400 });
  }

  const body = await req.json();
  const { opportunityId } = body;

  if (!opportunityId) {
    return new NextResponse("opportunity ID is required", { status: 400 });
  }

  try {
    const [contact, opportunity] = await Promise.all([
      prismadb.crm_Contacts.findUnique({
        where: { id: params.contactId },
        select: { id: true, team_id: true },
      }),
      prismadb.crm_Opportunities.findUnique({
        where: { id: opportunityId },
        select: { id: true, team_id: true },
      }),
    ]);

    if (!contact || !opportunity) {
      return new NextResponse("Contact or opportunity not found", { status: 404 });
    }

    if (
      !validateResourceOwnership(teamInfo!.teamId, contact.team_id, teamInfo!.isPlatformAdmin) ||
      !validateResourceOwnership(teamInfo!.teamId, opportunity.team_id, teamInfo!.isPlatformAdmin)
    ) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await prismadb.crm_Contacts.update({
      where: {
        id: params.contactId,
      },
      data: {
        assigned_opportunities: {
          disconnect: {
            id: opportunityId,
          },
        },
      },
    });
  } catch (error) {
    console.log(error);
    return new NextResponse(
      "[CONTACTS - UNLINK - PUT] - Error, somethings went wrong",
      { status: 500 }
    );
  }
  return NextResponse.json("Hello World", { status: 200 });
}
