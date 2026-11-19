import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { v4 as uuid } from "uuid";

/**
 * POST /api/workflows/[id]/webhook-token
 * Generate or regenerate a webhook token for a workflow.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { id } = await params;
        const existing = await prismadb.crm_Workflow.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing) {
            return new NextResponse("Workflow not found", { status: 404 });
        }
        if (!validateResourceOwnership(teamInfo!.teamId, existing.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const token = uuid();

        await prismadb.crm_Workflow.update({
            where: { id },
            data: { webhook_token: token },
        });

        return NextResponse.json({
            webhook_token: token,
            webhook_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/workflows/webhook/${token}`,
        });
    } catch (error) {
        console.error("[WEBHOOK_TOKEN_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * DELETE /api/workflows/[id]/webhook-token
 * Revoke/remove the webhook token.
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { id } = await params;
        const existing = await prismadb.crm_Workflow.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing) {
            return new NextResponse("Workflow not found", { status: 404 });
        }
        if (!validateResourceOwnership(teamInfo!.teamId, existing.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        await prismadb.crm_Workflow.update({
            where: { id },
            data: { webhook_token: null },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[WEBHOOK_TOKEN_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
