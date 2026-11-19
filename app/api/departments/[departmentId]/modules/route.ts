import { NextResponse } from "next/server";
import { getSessionAndTeam } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

/**
 * GET /api/departments/[departmentId]/modules
 * Returns the allowed_modules for a department and its parent's limits.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ departmentId: string }> }
) {
    const { departmentId } = await params;
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const department = await prismadb.team.findUnique({
            where: { id: departmentId },
            include: {
                parent_team: {
                    include: { assigned_plan: true }
                }
            }
        });

        if (!department) {
            return NextResponse.json({ error: "Department not found" }, { status: 404 });
        }

        const isAuthorized =
            teamInfo!.isPlatformAdmin ||
            (Boolean(teamInfo!.teamId) &&
                (department.parent_id === teamInfo!.teamId || department.id === teamInfo!.teamId));

        if (!isAuthorized) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const planSlug = department.parent_team?.assigned_plan?.slug || department.parent_team?.subscription_plan || "FREE";
        const { getSubscriptionPlan } = await import("@/lib/subscription");
        let parentLimits = getSubscriptionPlan(planSlug).features || [];

        if (department.parent_team?.assigned_plan) {
            parentLimits = Array.from(new Set([...department.parent_team.assigned_plan.features, ...parentLimits]));
        }
        if (department.parent_team?.module_overrides) {
            parentLimits = Array.from(new Set([...parentLimits, ...department.parent_team.module_overrides]));
        }

        return NextResponse.json({
            modules: department.allowed_modules || [],
            name: department.name,
            parentLimits
        });
    } catch (error) {
        systemLogger.error("[DEPT_MODULES_GET]", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

/**
 * PUT /api/departments/[departmentId]/modules
 * Company admin sets the module whitelist for a department.
 */
export async function PUT(
    req: Request,
    { params }: { params: Promise<{ departmentId: string }> }
) {
    const { departmentId } = await params;
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        if (!teamInfo!.isAdmin) {
            return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
        }

        const body = await req.json();
        const { modules } = body;

        if (!Array.isArray(modules) || !modules.every((m) => typeof m === "string")) {
            return NextResponse.json({ error: "Invalid modules format" }, { status: 400 });
        }

        const department = await prismadb.team.findUnique({
            where: { id: departmentId },
            include: { parent_team: { include: { assigned_plan: true } } }
        });

        if (!department) {
            return NextResponse.json({ error: "Department not found" }, { status: 404 });
        }

        const isAuthorized =
            teamInfo!.isPlatformAdmin ||
            (Boolean(teamInfo!.teamId) &&
                (department.parent_id === teamInfo!.teamId || department.id === teamInfo!.teamId));

        if (!isAuthorized) {
            return NextResponse.json({ error: "Forbidden: Cross-tenant access denied" }, { status: 403 });
        }

        const planSlug = department.parent_team?.assigned_plan?.slug || department.parent_team?.subscription_plan || "FREE";
        const { getSubscriptionPlan } = await import("@/lib/subscription");
        let parentLimits = getSubscriptionPlan(planSlug).features || [];

        if (department.parent_team?.assigned_plan) {
            parentLimits = Array.from(new Set([...department.parent_team.assigned_plan.features, ...parentLimits]));
        }
        if (department.parent_team?.module_overrides) {
            parentLimits = Array.from(new Set([...parentLimits, ...department.parent_team.module_overrides]));
        }

        const isSuperAdmin = teamInfo!.isPlatformAdmin || parentLimits.includes("all");
        const safeModules = isSuperAdmin
            ? modules
            : modules.filter((m) => parentLimits.includes(m) || parentLimits.includes(`${m}.view`));

        const updated = await prismadb.team.update({
            where: { id: departmentId },
            data: { allowed_modules: safeModules }
        });

        systemLogger.info(`[DEPT_MODULES] Updated modules for department ${departmentId}:`, safeModules);
        return NextResponse.json({ modules: updated.allowed_modules });
    } catch (error) {
        systemLogger.error("[DEPT_MODULES_PUT]", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}
