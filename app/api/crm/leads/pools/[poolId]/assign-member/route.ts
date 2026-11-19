import { NextResponse } from "next/server";
import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { sendAssignmentNotification } from "@/lib/notifications/assignment-notify";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

/**
 * POST /api/crm/leads/pools/[poolId]/assign-member
 * Assigns a member to a lead pool
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ poolId: string }> }
) {
    const { poolId } = await params;
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required" },
                { status: 400 }
            );
        }

        if (!teamInfo!.isAdmin && !teamInfo!.isPlatformAdmin) {
            return NextResponse.json(
                { error: "Only admins can assign members to pools" },
                { status: 403 }
            );
        }

        // Get current pool and verify tenant ownership
        const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
            where: { id: poolId },
            select: { id: true, team_id: true, assigned_members: true, name: true, description: true },
        });

        if (!pool) {
            return NextResponse.json(
                { error: "Pool not found" },
                { status: 404 }
            );
        }

        if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        // Verify target member belongs to the pool's team
        const targetTeamId = pool.team_id || teamInfo!.teamId;
        const assignedMember = await prismadb.users.findFirst({
            where: {
                id: String(userId),
                ...(targetTeamId ? { team_id: targetTeamId } : {}),
            },
            select: { id: true, name: true, email: true },
        });
        if (!assignedMember) {
            return NextResponse.json(
                { error: "Member not found in this team" },
                { status: 404 }
            );
        }

        const currentMembers = pool.assigned_members || [];

        if (currentMembers.includes(userId)) {
            return NextResponse.json(
                { error: "Member already assigned to this pool" },
                { status: 400 }
            );
        }

        // Add member to pool
        await (prismadbCrm as any).crm_Lead_Pools.update({
            where: { id: poolId },
            data: {
                assigned_members: [...currentMembers, userId],
            },
        });

        // Send notification (fire and forget)
        if (assignedMember.email) {
            sendAssignmentNotification({
                memberEmail: assignedMember.email,
                memberName: assignedMember.name || "Team Member",
                memberId: assignedMember.id,
                senderId: session!.user.id,
                teamId: targetTeamId || undefined,
                assignedByName: session!.user.name || "Admin",
                assignmentType: "pool",
                assignmentName: pool.name || "List",
                assignmentId: poolId,
                role: "Member",
                description: pool.description || undefined,
            }).catch((err) => systemLogger.error("[NOTIFY] Pool assignment notification failed:", err));
        }

        await logActivityInternal(session!.user.email || "SYSTEM", "UPDATE", "crm_Lead_Pools", `Assigned member ${userId} to pool ${poolId}`);
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        systemLogger.error("[POOL_ASSIGN_MEMBER_POST]", error);
        return new NextResponse("Failed to assign member", { status: 500 });
    }
}

/**
 * DELETE /api/crm/leads/pools/[poolId]/assign-member?userId=xxx
 * Removes a member from a lead pool
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ poolId: string }> }
) {
    const { poolId } = await params;
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");

        if (!userId) {
            return NextResponse.json(
                { error: "userId is required" },
                { status: 400 }
            );
        }

        if (!teamInfo!.isAdmin && !teamInfo!.isPlatformAdmin) {
            return NextResponse.json(
                { error: "Only admins can remove members from pools" },
                { status: 403 }
            );
        }

        // Get current pool and verify tenant ownership
        const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
            where: { id: poolId },
            select: { id: true, team_id: true, assigned_members: true },
        });

        if (!pool) {
            return NextResponse.json(
                { error: "Pool not found" },
                { status: 404 }
            );
        }

        if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        const currentMembers = pool.assigned_members || [];

        // Remove member from pool
        await (prismadbCrm as any).crm_Lead_Pools.update({
            where: { id: poolId },
            data: {
                assigned_members: currentMembers.filter((id: string) => id !== userId),
            },
        });

        await logActivityInternal(session!.user.email || "SYSTEM", "UPDATE", "crm_Lead_Pools", `Removed member ${userId} from pool ${poolId}`);
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        systemLogger.error("[POOL_REMOVE_MEMBER_DELETE]", error);
        return new NextResponse("Failed to remove member", { status: 500 });
    }
}

/**
 * GET /api/crm/leads/pools/[poolId]/assign-member
 * Gets assigned members for a pool
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ poolId: string }> }
) {
    const { poolId } = await params;
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    try {
        const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
            where: { id: poolId },
            select: { id: true, user: true, team_id: true, assigned_members: true },
        });

        if (!pool) {
            return NextResponse.json(
                { error: "Pool not found" },
                { status: 404 }
            );
        }

        if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        const memberIds = pool.assigned_members || [];
        if (
            !teamInfo!.isPlatformAdmin &&
            !teamInfo!.isAdmin &&
            pool.user !== session!.user.id &&
            !memberIds.includes(session!.user.id)
        ) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (memberIds.length === 0) {
            return NextResponse.json({ members: [] }, { status: 200 });
        }

        // Get member details scoped to pool's team if present
        const members = await prismadb.users.findMany({
            where: {
                id: { in: memberIds },
                ...(pool.team_id ? { team_id: pool.team_id } : {}),
            },
            select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
            },
        });

        return NextResponse.json({ members }, { status: 200 });
    } catch (error) {
        systemLogger.error("[POOL_MEMBERS_GET]", error);
        return new NextResponse("Failed to fetch pool members", { status: 500 });
    }
}
