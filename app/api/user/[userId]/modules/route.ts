import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership, unauthorizedResponse } from "@/lib/api-utils";
import { sanitizeUser } from "@/lib/security/authz";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

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
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const user = await prismadb.users.findUnique({
            where: { id: userId },
            select: { assigned_modules: true, team_id: true, assigned_team: { select: { parent_id: true } } },
        });

        if (!user) {
            return NextResponse.json({ assigned_modules: [] });
        }

        if (!isSelf) {
            const isChildDept = Boolean(teamInfo?.teamId && user.assigned_team?.parent_id === teamInfo.teamId);
            if (
                !isChildDept &&
                !validateResourceOwnership(teamInfo!.teamId, user.team_id, teamInfo!.isPlatformAdmin)
            ) {
                return await unauthorizedResponse("READ_MODULES", `Users:${userId}`);
            }
        }

        return NextResponse.json({ assigned_modules: user.assigned_modules || [] });
    } catch (error) {
        systemLogger.error("[USER_MODULES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params;
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return new NextResponse("Forbidden: Admin access required", { status: 403 });
        }

        const targetUser = await prismadb.users.findUnique({
            where: { id: userId },
            select: { id: true, team_id: true, assigned_team: { select: { parent_id: true } } },
        });

        if (!targetUser) {
            return new NextResponse("User not found", { status: 404 });
        }

        const isChildDept = Boolean(teamInfo!.teamId && targetUser.assigned_team?.parent_id === teamInfo!.teamId);
        if (
            !isChildDept &&
            !validateResourceOwnership(teamInfo!.teamId, targetUser.team_id, teamInfo!.isPlatformAdmin)
        ) {
            return await unauthorizedResponse("UPDATE_MODULES", `Users:${userId}`);
        }

        const body = await req.json();
        const { modules } = body;

        if (!Array.isArray(modules) || !modules.every((m) => typeof m === "string")) {
            return new NextResponse("Invalid modules format", { status: 400 });
        }

        const user = await prismadb.users.update({
            where: {
                id: userId,
            },
            data: {
                assigned_modules: modules,
            },
        });

        return NextResponse.json(sanitizeUser(user));
    } catch (error) {
        systemLogger.error("[USER_MODULES_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
