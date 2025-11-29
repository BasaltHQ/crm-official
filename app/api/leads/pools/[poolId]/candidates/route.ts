import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";

/**
 * GET /api/leads/pools/[poolId]/candidates
 * Returns lead candidates and their contact candidates for a given pool.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ poolId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { poolId } = await context.params;
  if (!poolId) {
    return new NextResponse("Missing poolId", { status: 400 });
  }

  try {
    // Verify pool ownership or admin access
    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { is_admin: true, is_account_admin: true },
    });
    const isAdmin = !!(user?.is_admin || user?.is_account_admin);

    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true },
    });
    if (!pool) return new NextResponse("Pool not found", { status: 404 });
    if (!isAdmin && pool.user !== session.user.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const candidates = await (prismadbCrm as any).crm_Lead_Candidates.findMany({
      where: { pool: poolId },
      orderBy: { score: "desc" },
      select: {
        id: true,
        domain: true,
        companyName: true,
        homepageUrl: true,
        description: true,
        industry: true,
        techStack: true,
        score: true,
        freshnessAt: true,
        status: true,
        contacts: {
          select: {
            id: true,
            fullName: true,
            title: true,
            email: true,
            emailStatus: true,
            phone: true,
            linkedinUrl: true,
            confidence: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ candidates }, { status: 200 });
  } catch (error) {
    console.error("[LEADS_POOL_CANDIDATES_GET]", error);
    return new NextResponse("Failed to fetch candidates", { status: 500 });
  }
}
