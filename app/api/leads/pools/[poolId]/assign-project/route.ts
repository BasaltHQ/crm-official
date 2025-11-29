import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";

export async function PATCH(req: Request, context: { params: Promise<{ poolId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { poolId } = await context.params;
    if (!poolId) return new NextResponse("Missing poolId", { status: 400 });

    const body = await req.json().catch(() => ({}));
    const projectId = String(body?.projectId || "").trim();
    if (!projectId) return new NextResponse("Missing projectId", { status: 400 });

    // Validate project exists and accessible
    const project = await prismadb.boards.findUnique({
      where: { id: projectId },
      select: { id: true, user: true, sharedWith: true },
    });
    if (!project) return new NextResponse("Project not found", { status: 404 });
    const canAccess = project.user === session.user.id || (project.sharedWith || []).includes(session.user.id);
    if (!canAccess) return new NextResponse("Forbidden", { status: 403 });

    // Validate pool ownership
    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { id: true, user: true, icpConfig: true },
    });
    if (!pool) return new NextResponse("Pool not found", { status: 404 });
    if (pool.user !== session.user.id) return new NextResponse("Forbidden", { status: 403 });

    const nextConfig = { ...(pool.icpConfig || {}), assignedProjectId: projectId };
    await (prismadbCrm as any).crm_Lead_Pools.update({
      where: { id: poolId },
      data: { icpConfig: nextConfig as any },
    });

    return NextResponse.json({ ok: true, icpConfig: nextConfig }, { status: 200 });
  } catch (e) {
    console.error("[ASSIGN_PROJECT_PATCH]", e);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
