import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";

export async function GET(req: Request, props: { params: Promise<{ leadId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse("Unauthenticated", { status: 401 });

  const leadId = params.leadId;
  if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

  try {
    // Find pools that include this lead (most recent first)
    const maps = await (prismadbCrm as any).crm_Lead_Pools_Leads.findMany({
      where: { lead: leadId },
      select: { pool: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    for (const m of maps) {
      if (!m?.pool) continue;
      const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
        where: { id: m.pool },
        select: { icpConfig: true },
      });
      const projectId = (pool?.icpConfig as any)?.assignedProjectId as string | undefined;
      if (projectId) {
        const board = await (prismadb as any).boards.findUnique({
          where: { id: projectId },
          select: { id: true, brand_logo_url: true, brand_primary_color: true },
        });
        if (board) {
          return NextResponse.json({
            projectId: board.id,
            brand_logo_url: board.brand_logo_url || null,
            brand_primary_color: board.brand_primary_color || null,
          }, { status: 200 });
        }
      }
    }

    // No branding found
    return NextResponse.json({ projectId: null, brand_logo_url: null, brand_primary_color: null }, { status: 200 });
  } catch (e) {
    console.error("[LEAD_BRAND_GET]", e);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
