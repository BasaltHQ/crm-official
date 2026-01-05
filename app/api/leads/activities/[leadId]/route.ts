import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

// GET /api/leads/activities/:leadId
// Returns recent lead activities (latest first). Non-admins are restricted to their assigned leads.
type Params = { params: Promise<{ leadId: string }> };
export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { leadId } = await params;
    if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

    // Determine admin privileges
    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { is_admin: true, is_account_admin: true },
    });
    const isAdmin = !!(user?.is_admin || user?.is_account_admin);

    // If not admin, verify the lead belongs to current user
    if (!isAdmin) {
      const lead = await prismadb.crm_Leads.findUnique({
        where: { id: leadId },
        select: { assigned_to: true },
      });
      if (!lead || lead.assigned_to !== session.user.id) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const activities = await prismadb.crm_Lead_Activities.findMany({
      where: { lead: leadId },
      orderBy: { createdAt: "desc" as const },
      take: 20,
      select: {
        id: true,
        type: true,
        metadata: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ activities }, { status: 200 });
  } catch (error) {
     
    console.error("[LEAD_ACTIVITIES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
