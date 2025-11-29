import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { describeContact } from "@/lib/aws/connect";

// Ensure this dynamic route is treated as dynamic (params available at request time)
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { contactId } = await params;
    if (!contactId) return new NextResponse("contactId required", { status: 400 });

    let desc: any = undefined;
    let state: string = "UNKNOWN";

    const hasInstance = !!(process.env.CONNECT_INSTANCE_ID && String(process.env.CONNECT_INSTANCE_ID).trim());
    if (hasInstance) {
      try {
        desc = await describeContact(undefined, contactId);
        state = (desc?.Status?.State as string) || (desc?.Status as string) || "UNKNOWN";
        // If Connect lookup returns nothing or unknown, assume SMA transaction and mark as INITIATED
        if (!desc || state === "UNKNOWN") {
          state = "INITIATED";
        }
      } catch (e: any) {
        console.warn("[CALL_STATUS][CONNECT_DESC_WARN]", e?.message || e);
        state = "INITIATED";
      }
    } else {
      // No Connect instance configured; this likely isn't a Connect contact (e.g., Chime SMA transaction)
      state = "INITIATED";
    }

    // Best-effort update of mapped lead
    try {
      const lead = await prismadb.crm_Leads.findFirst({ where: { connect_contact_id: contactId }, select: { id: true } });
      if (lead) {
        await prismadb.crm_Leads.update({ where: { id: lead.id }, data: { call_status: state as any } });
      }
    } catch {}

    return NextResponse.json({ contactId, state, raw: desc }, { status: 200 });
  } catch (error: any) {
    console.error("[CALL_STATUS]", error?.message || error);
    return new NextResponse(error?.message || "Internal Error", { status: 500 });
  }
}
