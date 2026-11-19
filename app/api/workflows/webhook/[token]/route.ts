import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { runWorkflowEngine } from "@/lib/workflow/engine";
import { systemLogger } from "@/lib/logger";

/**
 * POST /api/workflows/webhook/[token]
 * External webhook trigger for workflows.
 * 
 * Any external system (Zapier, n8n, custom scripts) can fire a workflow
 * by POSTing JSON data to this endpoint with the workflow's webhook_token.
 * 
 * Usage: POST https://crm.basalthq.com/api/workflows/webhook/{webhook_token}
 * Body: { ...any JSON payload... }
 * 
 * The payload becomes the trigger_data for the workflow execution.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params;
        if (!token || typeof token !== "string" || token.trim().length < 16) {
            return NextResponse.json(
                { error: "Invalid webhook token or workflow is not active" },
                { status: 404 }
            );
        }

        // Find workflow by webhook token
        const workflow = await prismadb.crm_Workflow.findFirst({
            where: {
                webhook_token: token,
                status: "ACTIVE",
            },
        });

        if (!workflow || !workflow.team_id) {
            return NextResponse.json(
                { error: "Invalid webhook token or workflow is not active" },
                { status: 404 }
            );
        }

        // Parse the incoming payload
        let payload: any = {};
        try {
            payload = await req.json();
        } catch {
            // Allow empty body
        }

        // Add webhook metadata to the trigger data
        const triggerData = {
            ...payload,
            _webhook: {
                receivedAt: new Date().toISOString(),
                workflowId: workflow.id,
                workflowName: workflow.name,
                source: req.headers.get("user-agent") || "unknown",
                ip: req.headers.get("x-forwarded-for") || "unknown",
            },
        };

        // Create execution record
        const execution = await prismadb.crm_Workflow_Execution.create({
            data: {
                workflow_id: workflow.id,
                status: "RUNNING",
                trigger_data: triggerData,
                trigger_source: "webhook",
            },
        });

        systemLogger.info(`[WEBHOOK_TRIGGER] Workflow "${workflow.name}" triggered via webhook. Execution: ${execution.id}`);

        // Run the workflow engine asynchronously (don't await — return immediately)
        runWorkflowEngine(execution.id).catch(err => {
            systemLogger.error(`[WEBHOOK_TRIGGER] Engine error for execution ${execution.id}:`, err);
        });

        return NextResponse.json({
            success: true,
            executionId: execution.id,
            workflowName: workflow.name,
            message: "Workflow triggered successfully",
        });
    } catch (error: any) {
        systemLogger.error("[WEBHOOK_TRIGGER] Error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/workflows/webhook/[token]
 * Health check / info endpoint for the webhook.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    if (!token || typeof token !== "string" || token.trim().length < 16) {
        return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const workflow = await prismadb.crm_Workflow.findFirst({
        where: { webhook_token: token },
        select: { status: true, team_id: true },
    });

    if (!workflow || !workflow.team_id) {
        return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    return NextResponse.json({
        status: workflow.status,
        ready: workflow.status === "ACTIVE",
    });
}
