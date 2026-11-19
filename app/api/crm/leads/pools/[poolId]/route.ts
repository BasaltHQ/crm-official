import { NextResponse } from "next/server";
import { prismadbCrm } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function GET(req: Request, context: { params: Promise<{ poolId: string }> }) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { poolId } = await context.params;

        if (!poolId) {
            return new NextResponse("Missing poolId", { status: 400 });
        }

        const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
            where: { id: poolId },
            include: {
                _count: {
                    select: { candidates: true },
                },
            }
        });

        if (!pool) {
            return new NextResponse("Pool not found", { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const isOwner = pool.user === session!.user.id;
        const assignedMembers = pool.assigned_members || [];
        const isAssigned = assignedMembers.includes(session!.user.id);

        if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && !isOwner && !isAssigned) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        return NextResponse.json(pool);

    } catch (error: any) {
        systemLogger.error("[POOL_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(req: Request, context: { params: Promise<{ poolId: string }> }) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { poolId } = await context.params;
        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json({ error: "Name is required" }, { status: 400 });
        }

        const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
            where: { id: poolId },
            select: { id: true, user: true, team_id: true },
        });

        if (!pool) {
            return new NextResponse("Pool not found", { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const isOwner = pool.user === session!.user.id;
        if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && !isOwner) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const updated = await (prismadbCrm as any).crm_Lead_Pools.update({
            where: { id: poolId },
            data: { name: name.trim() },
        });

        return NextResponse.json({ id: updated.id, name: updated.name });

    } catch (error: any) {
        systemLogger.error("[POOL_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
