"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { WorkflowStatus, ExecutionStatus, Prisma } from "@prisma/client";
import { runWorkflowEngine } from "@/lib/workflow/engine";

// ============================================================================
// WORKFLOW CRUD OPERATIONS
// ============================================================================

export async function getWorkflows(teamId?: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        const effectiveTeamId = teamInfo.isPlatformAdmin && teamId ? teamId : teamInfo.teamId;
        if (!effectiveTeamId || effectiveTeamId.length !== 24) return [];

        if (teamId && !validateResourceOwnership(teamInfo.teamId, teamId, teamInfo.isPlatformAdmin)) {
            return [];
        }

        const workflows = await prismadb.crm_Workflow.findMany({
            where: { team_id: effectiveTeamId },
            orderBy: { updatedAt: 'desc' },
            include: {
                creator: {
                    select: { id: true, name: true, avatar: true }
                },
                _count: {
                    select: { executions: true }
                }
            }
        });

        return workflows;
    } catch (error) {
        console.error("Error fetching workflows:", error);
        return [];
    }
}

export async function getWorkflow(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        if (!id || id.length !== 24) return null;

        const workflow = await prismadb.crm_Workflow.findUnique({
            where: { id },
            include: {
                creator: {
                    select: { id: true, name: true, avatar: true }
                },
                executions: {
                    orderBy: { startedAt: 'desc' },
                    take: 10
                }
            }
        });

        if (!workflow) return null;
        if (!validateResourceOwnership(teamInfo.teamId, workflow.team_id, teamInfo.isPlatformAdmin)) {
            return null;
        }

        return workflow;
    } catch (error) {
        console.error("Error fetching workflow:", error);
        return null;
    }
}

interface CreateWorkflowData {
    name: string;
    description?: string;
    trigger_type: string;
    trigger_config?: Prisma.InputJsonValue;
    nodes: Prisma.InputJsonValue;
    edges: Prisma.InputJsonValue;
    team_id: string;
}

export async function createWorkflow(data: CreateWorkflowData) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) {
            throw new Error("Unauthorized");
        }

        const effectiveTeamId = teamInfo.isPlatformAdmin && data.team_id ? data.team_id : teamInfo.teamId;
        if (!effectiveTeamId) {
            return { success: false, error: "No team context" };
        }
        if (data.team_id && !validateResourceOwnership(teamInfo.teamId, data.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const workflow = await prismadb.crm_Workflow.create({
            data: {
                name: data.name,
                description: data.description,
                trigger_type: data.trigger_type,
                trigger_config: data.trigger_config ?? null,
                nodes: data.nodes,
                edges: data.edges,
                team_id: effectiveTeamId,
                created_by: session.user.id,
                status: WorkflowStatus.DRAFT
            }
        });

        revalidatePath('/crm/workflows');
        return { success: true, workflow };
    } catch (error) {
        console.error("Error creating workflow:", error);
        return { success: false, error: "Failed to create workflow" };
    }
}

interface UpdateWorkflowData {
    name?: string;
    description?: string;
    trigger_type?: string;
    trigger_config?: Prisma.InputJsonValue;
    nodes?: Prisma.InputJsonValue;
    edges?: Prisma.InputJsonValue;
}

export async function updateWorkflow(id: string, data: UpdateWorkflowData) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        if (!id || id.length !== 24) return { success: false, error: "Invalid workflow ID" };

        const existing = await prismadb.crm_Workflow.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing) return { success: false, error: "Workflow not found" };
        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const updateData: Prisma.crm_WorkflowUpdateInput = {};
        if (data.name) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.trigger_type) updateData.trigger_type = data.trigger_type;
        if (data.trigger_config) updateData.trigger_config = data.trigger_config;
        if (data.nodes) updateData.nodes = data.nodes;
        if (data.edges) updateData.edges = data.edges;

        const workflow = await prismadb.crm_Workflow.update({
            where: { id },
            data: updateData as any
        });

        revalidatePath('/crm/workflows');
        revalidatePath(`/crm/workflows/${id}`);
        return { success: true, workflow };
    } catch (error) {
        console.error("Error updating workflow:", error);
        return { success: false, error: "Failed to update workflow" };
    }
}

export async function deleteWorkflow(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        if (!id || id.length !== 24) return { success: false, error: "Invalid workflow ID" };

        const existing = await prismadb.crm_Workflow.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing) return { success: false, error: "Workflow not found" };
        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        await prismadb.crm_Workflow_Execution.deleteMany({
            where: { workflow_id: id }
        });

        await prismadb.crm_Workflow.delete({
            where: { id }
        });

        revalidatePath('/crm/workflows');
        return { success: true };
    } catch (error) {
        console.error("Error deleting workflow:", error);
        return { success: false, error: "Failed to delete workflow" };
    }
}

// ============================================================================
// WORKFLOW STATUS OPERATIONS
// ============================================================================

export async function activateWorkflow(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        const existing = await prismadb.crm_Workflow.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing) return { success: false, error: "Workflow not found" };
        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const workflow = await prismadb.crm_Workflow.update({
            where: { id },
            data: { status: WorkflowStatus.ACTIVE }
        });

        revalidatePath('/crm/workflows');
        return { success: true, workflow };
    } catch (error) {
        console.error("Error activating workflow:", error);
        return { success: false, error: "Failed to activate workflow" };
    }
}

export async function pauseWorkflow(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        const existing = await prismadb.crm_Workflow.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing) return { success: false, error: "Workflow not found" };
        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const workflow = await prismadb.crm_Workflow.update({
            where: { id },
            data: { status: WorkflowStatus.PAUSED }
        });

        revalidatePath('/crm/workflows');
        return { success: true, workflow };
    } catch (error) {
        console.error("Error pausing workflow:", error);
        return { success: false, error: "Failed to pause workflow" };
    }
}

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

async function triggerWorkflowInternal(workflowId: string, triggerData: Prisma.InputJsonValue = {}) {
    if (!workflowId || workflowId.length !== 24) return { success: false, error: "Invalid workflow ID" };

    const workflow = await prismadb.crm_Workflow.findUnique({
        where: { id: workflowId }
    });

    if (!workflow || workflow.status !== WorkflowStatus.ACTIVE) {
        return { success: false, error: "Workflow not found or not active" };
    }

    const execution = await prismadb.crm_Workflow_Execution.create({
        data: {
            workflow_id: workflowId,
            status: ExecutionStatus.RUNNING,
            trigger_data: triggerData,
            completed_nodes: []
        }
    });

    runWorkflowEngine(execution.id).catch(err => {
        console.error(`[WORKFLOW_TRIGGER_ERROR] ${execution.id}:`, err);
    });

    return { success: true, executionId: execution.id };
}

export async function triggerWorkflow(workflowId: string, triggerData: Prisma.InputJsonValue = {}) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            return { success: false, error: "Unauthorized" };
        }

        if (!workflowId || workflowId.length !== 24) return { success: false, error: "Invalid workflow ID" };

        const workflow = await prismadb.crm_Workflow.findUnique({
            where: { id: workflowId },
            select: { id: true, team_id: true, status: true },
        });

        if (!workflow || workflow.status !== WorkflowStatus.ACTIVE) {
            return { success: false, error: "Workflow not found or not active" };
        }

        if (!validateResourceOwnership(teamInfo.teamId, workflow.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        return await triggerWorkflowInternal(workflowId, triggerData);
    } catch (error) {
        console.error("Error triggering workflow:", error);
        return { success: false, error: "Failed to trigger workflow" };
    }
}

export async function getExecutions(workflowId: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        const workflow = await prismadb.crm_Workflow.findUnique({
            where: { id: workflowId },
            select: { id: true, team_id: true },
        });
        if (!workflow || !validateResourceOwnership(teamInfo.teamId, workflow.team_id, teamInfo.isPlatformAdmin)) {
            return [];
        }

        const executions = await prismadb.crm_Workflow_Execution.findMany({
            where: { workflow_id: workflowId },
            orderBy: { startedAt: 'desc' },
            take: 50
        });

        return executions;
    } catch (error) {
        console.error("Error fetching executions:", error);
        return [];
    }
}

export async function triggerWorkflowsByType(
    triggerType: string,
    triggerData: Prisma.InputJsonValue,
    teamId?: string
) {
    try {
        let resolvedTeamId = teamId;
        if (!resolvedTeamId) {
            const { error, teamInfo } = await getSessionAndTeam();
            if (error || !teamInfo?.teamId) {
                return { success: false, error: "Missing teamId context for workflow trigger" };
            }
            resolvedTeamId = teamInfo.teamId;
        }

        const workflows = await prismadb.crm_Workflow.findMany({
            where: {
                trigger_type: triggerType,
                status: WorkflowStatus.ACTIVE,
                team_id: resolvedTeamId,
            },
        });

        const results = await Promise.all(
            workflows.map((w: { id: string }) => triggerWorkflowInternal(w.id, triggerData))
        );

        return {
            success: true,
            triggered: results.filter((r: { success: boolean }) => r.success).length,
            total: workflows.length
        };
    } catch (error) {
        console.error("Error triggering workflows by type:", error);
        return { success: false, error: "Failed to trigger workflows" };
    }
}
