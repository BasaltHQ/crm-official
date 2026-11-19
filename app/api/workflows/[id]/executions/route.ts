import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

/**
 * GET /api/workflows/[id]/executions
 * List execution history for a workflow with step logs.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { id } = await params;

        const workflow = await prismadb.crm_Workflow.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!workflow) {
            return new NextResponse("Workflow not found", { status: 404 });
        }
        if (!validateResourceOwnership(teamInfo!.teamId, workflow.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const [executions, total] = await Promise.all([
            prismadb.crm_Workflow_Execution.findMany({
                where: { workflow_id: id },
                orderBy: { startedAt: "desc" },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    status: true,
                    trigger_source: true,
                    trigger_data: true,
                    current_node: true,
                    completed_nodes: true,
                    node_outputs: true,
                    step_logs: true,
                    scheduled_at: true,
                    error: true,
                    startedAt: true,
                    completedAt: true,
                },
            }),
            prismadb.crm_Workflow_Execution.count({
                where: { workflow_id: id },
            }),
        ]);

        return NextResponse.json({ executions, total, limit, offset });
    } catch (error) {
        console.error("[EXECUTIONS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
