import { NextResponse } from "next/server";
import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function PATCH(req: Request, context: { params: Promise<{ poolId: string }> }) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { poolId } = await context.params;
    if (!poolId) return new NextResponse("Missing poolId", { status: 400 });

    const teamId = teamInfo?.teamId;

    const body = await req.json().catch(() => ({}));
    const projectId = String(body?.projectId || "").trim();
    if (!projectId) return new NextResponse("Missing projectId", { status: 400 });

    // Validate project exists, belongs to tenant, and is accessible
    const project = await prismadb.boards.findUnique({
      where: { id: projectId },
      select: { id: true, user: true, sharedWith: true, team_id: true, visibility: true },
    });
    if (!project) return new NextResponse("Project not found", { status: 404 });

    if (!validateResourceOwnership(teamId || null, project.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden Project Access", { status: 403 });
    }

    const isOwner = project.user === session!.user.id;
    const isShared = (project.sharedWith || []).includes(session!.user.id);
    const isTeamPublic = !!(teamId && project.team_id === teamId && project.visibility === "public");

    const canAccess = teamInfo!.isPlatformAdmin || isOwner || isShared || isTeamPublic;
    if (!canAccess) return new NextResponse("Forbidden Project Access", { status: 403 });

    // Validate pool ownership and tenant scope (NEVER allow hijacking null-team pools of other users)
    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { id: true, user: true, team_id: true, icpConfig: true },
    });
    if (!pool) return new NextResponse("Pool not found", { status: 404 });

    if (!validateResourceOwnership(teamId || null, pool.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const isPoolOwner = pool.user === session!.user.id;
    if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && !isPoolOwner) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const nextConfig = { ...(pool.icpConfig || {}), assignedProjectId: projectId };
    await (prismadbCrm as any).crm_Lead_Pools.update({
      where: { id: poolId },
      data: { icpConfig: nextConfig as any },
    });

    return NextResponse.json({ ok: true, icpConfig: nextConfig }, { status: 200 });
  } catch (e) {
    systemLogger.error("[ASSIGN_PROJECT_PATCH]", e);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
