import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { sanitizeUser } from "@/lib/security/authz";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

/**
 * GET /api/users/[userId]/modules
 * Returns the assigned_modules for a user.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        const isSelf = Boolean(
            session?.user?.id &&
            (session as any).error !== "SessionInvalidated" &&
            session.user.userStatus === "ACTIVE" &&
            session.user.id === userId
        );

        if (error && !isSelf) return error;
        if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prismadb.users.findUnique({
            where: { id: userId },
            select: {
                assigned_modules: true,
                name: true,
                team_id: true,
                assigned_team: { select: { parent_id: true } },
            },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (!isSelf) {
            const isChildDept = Boolean(teamInfo?.teamId && user.assigned_team?.parent_id === teamInfo.teamId);
            if (
                !isChildDept &&
                !validateResourceOwnership(teamInfo!.teamId, user.team_id, teamInfo!.isPlatformAdmin)
            ) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        return NextResponse.json({
            modules: user.assigned_modules || [],
            name: user.name,
        });
    } catch (error) {
        systemLogger.error("[USER_MODULES_GET]", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

/**
 * PUT /api/users/[userId]/modules
 * Admin sets the module whitelist for an individual user.
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const targetUser = await prismadb.users.findUnique({
            where: { id: userId },
            select: {
                id: true,
                team_id: true,
                assigned_team: { select: { parent_id: true } },
            },
        });

        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const isChildDept = Boolean(teamInfo!.teamId && targetUser.assigned_team?.parent_id === teamInfo!.teamId);
        if (
            !isChildDept &&
            !validateResourceOwnership(teamInfo!.teamId, targetUser.team_id, teamInfo!.isPlatformAdmin)
        ) {
            return NextResponse.json({ error: "Forbidden: Cross-tenant access denied" }, { status: 403 });
        }

        const body = await req.json();
        const { modules } = body;

        if (!Array.isArray(modules) || !modules.every((m) => typeof m === "string")) {
            return NextResponse.json({ error: "Invalid modules format" }, { status: 400 });
        }

        const updated = sanitizeUser(
            await prismadb.users.update({
                where: { id: userId },
                data: { assigned_modules: modules },
            })
        );

        systemLogger.info(`[USER_MODULES] Updated modules for user ${userId}:`, modules);
        return NextResponse.json({ modules: updated.assigned_modules });
    } catch (error) {
        systemLogger.error("[USER_MODULES_PUT]", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
