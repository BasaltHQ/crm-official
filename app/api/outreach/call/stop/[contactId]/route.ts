import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { stopContact } from "@/lib/aws/connect";

export async function POST(
  _req: Request,
  { params }: any
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const contactId = params.contactId;
    if (!contactId) return new NextResponse("contactId required", { status: 400 });

    await stopContact(undefined, contactId);

    // Best-effort update of mapped lead
    try {
      const lead = await prismadb.crm_Leads.findFirst({ where: { connect_contact_id: contactId } });
      if (lead) {
        // Update status
        await prismadb.crm_Leads.update({ where: { id: lead.id }, data: { call_status: "ENDED" as any } });
        await prismadb.crm_Lead_Activities.create({
          data: {
            lead: lead.id,
            user: session.user.id,
            type: "call_ended",
            metadata: { contactId, pipeline_stage: "Engage_Human" } as any,
          },
        });

      }
    } catch {}

    return new NextResponse("Stopped", { status: 200 });
  } catch (error: any) {
    console.error("[CALL_STOP]", error?.message || error);
    return new NextResponse(error?.message || "Internal Error", { status: 500 });
  }
}
