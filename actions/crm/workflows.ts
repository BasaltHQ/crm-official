"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { WorkflowStatus, ExecutionStatus, Prisma } from "@prisma/client";

// ============================================================================
// WORKFLOW CRUD OPERATIONS
// ============================================================================

export async function getWorkflows(teamId?: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
        }

        const where = teamId ? { team_id: teamId } : {};

        const workflows = await prismadb.crm_Workflow.findMany({
            where,
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
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
        }

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
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
        }

        const workflow = await prismadb.crm_Workflow.create({
            data: {
                name: data.name,
                description: data.description,
                trigger_type: data.trigger_type,
                trigger_config: data.trigger_config ?? null,
                nodes: data.nodes,
                edges: data.edges,
                team_id: data.team_id,
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
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
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
            data: updateData
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
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
        }

        // Delete executions first
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
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
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
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
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

export async function triggerWorkflow(workflowId: string, triggerData: Prisma.InputJsonValue = {}) {
    try {
        // Get the workflow
        const workflow = await prismadb.crm_Workflow.findUnique({
            where: { id: workflowId }
        });

        if (!workflow || workflow.status !== WorkflowStatus.ACTIVE) {
            return { success: false, error: "Workflow not found or not active" };
        }

        // Create execution record
        const execution = await prismadb.crm_Workflow_Execution.create({
            data: {
                workflow_id: workflowId,
                status: ExecutionStatus.RUNNING,
                trigger_data: triggerData,
                completed_nodes: []
            }
        });

        // TODO: Start workflow engine execution
        // For now, just mark as completed for demo purposes
        await prismadb.crm_Workflow_Execution.update({
            where: { id: execution.id },
            data: {
                status: ExecutionStatus.COMPLETED,
                completedAt: new Date()
            }
        });

        return { success: true, executionId: execution.id };
    } catch (error) {
        console.error("Error triggering workflow:", error);
        return { success: false, error: "Failed to trigger workflow" };
    }
}

export async function getExecutions(workflowId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            throw new Error("Unauthorized");
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

// ============================================================================
// TRIGGER HELPERS - Called from other modules
// ============================================================================

/**
 * Trigger all workflows that match a specific trigger type
 * Called from DealRoom, Forms, Leads, etc.
 */
export async function triggerWorkflowsByType(
    triggerType: string,
    triggerData: Prisma.InputJsonValue,
    teamId?: string
) {
    try {
        const where: { trigger_type: string; status: WorkflowStatus; team_id?: string } = {
            trigger_type: triggerType,
            status: WorkflowStatus.ACTIVE
        };

        if (teamId) {
            where.team_id = teamId;
        }

        const workflows = await prismadb.crm_Workflow.findMany({ where });

        const results = await Promise.all(
            workflows.map((w: { id: string }) => triggerWorkflow(w.id, triggerData))
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
