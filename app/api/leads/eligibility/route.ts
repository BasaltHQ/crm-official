import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/leads/eligibility
 * Body: { leadIds: string[] }
 * Returns counts and per-lead availability for email/phone.
 */

type RequestBody = { leadIds: string[] };

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const body = (await req.json()) as RequestBody;
    if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) {
      return new NextResponse("No leads provided", { status: 400 });
    }

    const leads = await prismadb.crm_Leads.findMany({
      where: { id: { in: body.leadIds } },
      select: { id: true, email: true, phone: true },
    });

    const perLead = leads.map((l) => ({ id: l.id, hasEmail: !!(l.email && String(l.email).trim().length > 0), hasPhone: !!(l.phone && String(l.phone).trim().length > 0) }));
    const counts = {
      total: leads.length,
      emailsPresent: perLead.filter((p) => p.hasEmail).length,
      phonesPresent: perLead.filter((p) => p.hasPhone).length,
    };

    return NextResponse.json({ counts, perLead }, { status: 200 });
  } catch (error) {
    console.error("[LEADS_ELIGIBILITY_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
