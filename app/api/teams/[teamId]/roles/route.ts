import { NextRequest, NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { prismadb } from "@/lib/prisma";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

// GET /api/teams/[teamId]/roles - Get all roles for a team
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { teamId } = await params;

        if (!validateResourceOwnership(teamInfo!.teamId, teamId, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const roles = await prismadb.customRole.findMany({
            where: { team_id: teamId },
            include: { _count: { select: { users: true } } },
            orderBy: { created_at: "asc" },
        });

        return NextResponse.json(roles);
    } catch (error) {
        systemLogger.error("[TEAM_ROLES_GET]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// POST /api/teams/[teamId]/roles - Create a new custom role
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ teamId: string }> }
) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { teamId } = await params;

        if (!validateResourceOwnership(teamInfo!.teamId, teamId, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const platformAdmin = await requirePlatformAdmin();
        if (!platformAdmin) {
            return NextResponse.json({ error: "Only platform admins can create roles" }, { status: 403 });
        }

        const body = await request.json();
        const { name, description, modules } = body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return NextResponse.json({ error: "Role name is required" }, { status: 400 });
        }

        const safeModules = Array.isArray(modules)
            ? modules.filter((m: unknown): m is string => typeof m === "string")
            : [];

        const existingRole = await prismadb.customRole.findFirst({
            where: { team_id: teamId, name: name.trim() },
        });

        if (existingRole) {
            return NextResponse.json({ error: "A role with this name already exists" }, { status: 400 });
        }

        const role = await prismadb.customRole.create({
            data: {
                name: name.trim(),
                description: typeof description === "string" ? description : null,
                modules: safeModules,
                team_id: teamId,
            },
        });

        await logActivityInternal(
            session!.user.id,
            "CREATE",
            "CustomRole",
            `Created custom role ${role.name}`,
            teamId
        );
        return NextResponse.json(role, { status: 201 });
    } catch (error) {
        systemLogger.error("[TEAM_ROLES_POST]", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
