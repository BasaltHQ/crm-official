import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

//Contact delete route
export async function DELETE(req: Request, props: { params: Promise<{ contactId: string }> }) {
  const params = await props.params;
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  if (!params.contactId) {
    return new NextResponse("contact ID is required", { status: 400 });
  }

  try {
    const contact = await prismadb.crm_Contacts.findUnique({
      where: { id: params.contactId },
      select: { id: true, team_id: true },
    });
    if (!contact) {
      return new NextResponse("Contact not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo!.teamId, contact.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await prismadb.crm_Contacts.delete({
      where: {
        id: params.contactId,
      },
    });

    return NextResponse.json({ message: "Contact deleted" }, { status: 200 });
  } catch (error) {
    systemLogger.error("[CONTACT_DELETE]", error);
    return new NextResponse("Initial error", { status: 500 });
  }
}
