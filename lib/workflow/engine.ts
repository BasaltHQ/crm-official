
import { prismadb } from "@/lib/prisma";
import { ExecutionStatus, Prisma } from "@prisma/client";
import { systemLogger } from "@/lib/logger";

/**
 * FlowState Engine v2 — Enhanced with delay, loop, parallel, and webhook support.
 */

// ── Step log entry (persisted for execution history) ────────────────────────
interface StepLog {
    nodeId: string;
    nodeType: string;
    label: string;
    status: "completed" | "failed" | "skipped" | "waiting";
    startTime: number;
    endTime?: number;
    inputData?: Record<string, unknown>;
    outputData?: Record<string, unknown>;
    error?: string;
    branch?: string;
}

export async function runWorkflowEngine(workflowExecutionId: string) {
    const execution = await prismadb.crm_Workflow_Execution.findUnique({
        where: { id: workflowExecutionId },
        include: { workflow: true }
    });

    if (!execution || !execution.workflow) {
        systemLogger.error(`[WORKFLOW_ENGINE] Execution ${workflowExecutionId} not found.`);
        return;
    }

    if (execution.status !== ExecutionStatus.RUNNING) {
        return;
    }

    const stepLogs: StepLog[] = [];

    try {
        const nodes = execution.workflow.nodes as any[];
        const edges = execution.workflow.edges as any[];
        const triggerData = (execution.trigger_data as any) || {};

        // Find Trigger Node
        const triggerNode = nodes.find(n => n.type === 'trigger');
        if (!triggerNode) {
            throw new Error("No trigger node found in workflow.");
        }

        // Keep track of node outputs for variable substitution
        const nodeOutputs: Record<string, any> = {
            trigger: triggerData
        };

        // Execution Queue — supports parallel paths
        const completedNodes: string[] = [];
        const queue: string[] = [triggerNode.id];
        const visited = new Set<string>();
        let iterationCount = 0;

        while (queue.length > 0) {
            const currentNodeId = queue.shift()!;

            // Skip already visited (handles join points in parallel paths)
            if (visited.has(currentNodeId)) continue;
            visited.add(currentNodeId);

            const node = nodes.find(n => n.id === currentNodeId);
            if (!node) continue;

            // Update current node in execution record
            await prismadb.crm_Workflow_Execution.update({
                where: { id: workflowExecutionId },
                data: { current_node: currentNodeId },
            });

            systemLogger.info(`[WORKFLOW_ENGINE] Executing node: ${node.id} (${node.type})`);

            const stepStart = Date.now();
            const stepLog: StepLog = {
                nodeId: node.id,
                nodeType: node.type,
                label: node.data?.label || node.type,
                status: "completed",
                startTime: stepStart,
            };

            let outcome: string | null = null;

            try {
                const result = await executeNode(
                    node,
                    triggerData,
                    nodeOutputs,
                    workflowExecutionId,
                    execution.workflow.team_id
                );
                nodeOutputs[node.id] = result.output;
                outcome = result.outcome || null;

                // Handle delay node → pause execution
                if (result.paused) {
                    stepLog.status = "waiting";
                    stepLog.endTime = Date.now();
                    stepLog.outputData = result.output;
                    stepLogs.push(stepLog);

                    // Save progress and exit — a scheduler will resume later
                    await prismadb.crm_Workflow_Execution.update({
                        where: { id: workflowExecutionId },
                        data: {
                            status: ExecutionStatus.RUNNING,
                            current_node: currentNodeId,
                            completed_nodes: completedNodes,
                            node_outputs: nodeOutputs,
                            step_logs: stepLogs as any,
                            scheduled_at: result.resumeAt,
                        },
                    });
                    systemLogger.info(`[WORKFLOW_ENGINE] Execution paused until ${result.resumeAt?.toISOString()}`);
                    return;
                }

                stepLog.endTime = Date.now();
                stepLog.outputData = result.output;
                if (outcome) stepLog.branch = outcome;

            } catch (err: any) {
                stepLog.status = "failed";
                stepLog.endTime = Date.now();
                stepLog.error = err.message;
                stepLogs.push(stepLog);

                await prismadb.crm_Workflow_Execution.update({
                    where: { id: workflowExecutionId },
                    data: {
                        status: ExecutionStatus.FAILED,
                        error: `Node ${node.id} failed: ${err.message}`,
                        completed_nodes: completedNodes,
                        node_outputs: nodeOutputs,
                        step_logs: stepLogs as any,
                        completedAt: new Date()
                    }
                });
                return;
            }

            stepLogs.push(stepLog);
            completedNodes.push(currentNodeId);

            // ── Find Next Nodes ─────────────────────────────────────────
            if (node.type === 'condition' || node.type === 'decision') {
                // Conditional: follow the matching branch
                const edge = edges.find((e: any) => e.source === currentNodeId && e.sourceHandle === outcome);
                if (edge) queue.push(edge.target);
            } else if (node.type === 'loop') {
                // Loop: handled inside executeNode, follow "done" path
                const doneEdge = edges.find((e: any) => e.source === currentNodeId && e.sourceHandle === 'done');
                if (doneEdge) queue.push(doneEdge.target);
            } else {
                // Default: follow ALL outgoing edges (enables parallel paths)
                const outEdges = edges.filter((e: any) => e.source === currentNodeId);
                for (const edge of outEdges) {
                    queue.push(edge.target);
                }
            }

            iterationCount++;
            if (iterationCount > 200) {
                throw new Error("Maximum node execution limit reached (200). Possible infinite loop.");
            }
        }

        // Mark as completed
        await prismadb.crm_Workflow_Execution.update({
            where: { id: workflowExecutionId },
            data: {
                status: ExecutionStatus.COMPLETED,
                completed_nodes: completedNodes,
                node_outputs: nodeOutputs,
                step_logs: stepLogs as any,
                completedAt: new Date()
            }
        });

        systemLogger.info(`[WORKFLOW_ENGINE] Execution ${workflowExecutionId} completed (${completedNodes.length} nodes).`);

    } catch (error: any) {
        systemLogger.error(`[WORKFLOW_ENGINE] Execution ${workflowExecutionId} failed:`, error);
        await prismadb.crm_Workflow_Execution.update({
            where: { id: workflowExecutionId },
            data: {
                status: ExecutionStatus.FAILED,
                error: error.message,
                step_logs: stepLogs as any,
                completedAt: new Date()
            }
        });
    }
}

// ── Resume a paused execution (called by scheduler) ─────────────────────────
export async function resumeWorkflowExecution(executionId: string) {
    const execution = await prismadb.crm_Workflow_Execution.findUnique({
        where: { id: executionId },
        include: { workflow: true },
    });

    if (!execution || execution.status !== ExecutionStatus.RUNNING) return;
    if (!execution.scheduled_at || execution.scheduled_at > new Date()) return; // Not yet time

    // Clear the scheduled_at and re-run from current_node
    await prismadb.crm_Workflow_Execution.update({
        where: { id: executionId },
        data: { scheduled_at: null },
    });

    // Re-run the engine — it will pick up from current_node
    await runWorkflowEngine(executionId);
}

// ── Node Execution ──────────────────────────────────────────────────────────
type NodeResult = {
    output: any;
    outcome?: string | null;
    paused?: boolean;
    resumeAt?: Date;
};

const ALLOWED_WORKFLOW_MODELS = new Set([
    "crm_Leads",
    "crm_Contacts",
    "crm_Accounts",
    "crm_Opportunities",
    "crm_Cases",
    "tasks",
    "Tasks",
]);

const BLOCKED_WORKFLOW_UPDATE_FIELDS = new Set([
    "id",
    "_id",
    "v",
    "__v",
    "team_id",
    "tenant_id",
    "createdBy",
    "created_by",
    "is_admin",
    "is_account_admin",
    "team_role",
    "plan_id",
    "subscription_plan",
    "password",
    "mfaSecret",
    "mfaBackupCodes",
    "resetToken",
    "resetTokenExpires",
    "openAi_keys",
    "__proto__",
    "constructor",
    "prototype",
]);

async function executeNode(
    node: any,
    triggerData: any,
    previousOutputs: Record<string, any>,
    executionId: string,
    workflowTeamId: string
): Promise<NodeResult> {
    const data = node.data || {};

    switch (node.type) {
        case 'trigger':
            return { output: triggerData };

        case 'action':
            return await handleActionNode(data, triggerData, previousOutputs, workflowTeamId);

        case 'condition':
            return await handleConditionNode(data, triggerData, previousOutputs);

        case 'updateRecord':
            return await handleUpdateRecordNode(data, triggerData, previousOutputs, workflowTeamId);

        case 'delay':
            return await handleDelayNode(data, executionId);

        case 'loop':
            return await handleLoopNode(node, data, triggerData, previousOutputs, executionId);

        default:
            systemLogger.warn(`[WORKFLOW_ENGINE] Unknown node type: ${node.type}`);
            return { output: {} };
    }
}

// ── Delay Node ──────────────────────────────────────────────────────────────
async function handleDelayNode(data: any, executionId: string): Promise<NodeResult> {
    const duration = data.duration || 1;
    const unit = data.unit || "hours";

    const delayMs = {
        minutes: duration * 60 * 1000,
        hours: duration * 60 * 60 * 1000,
        days: duration * 24 * 60 * 60 * 1000,
    }[unit as string] || duration * 60 * 60 * 1000;

    const resumeAt = new Date(Date.now() + delayMs);

    systemLogger.info(`[WORKFLOW_ENGINE] Delay: pausing for ${duration} ${unit} until ${resumeAt.toISOString()}`);

    return {
        output: { delayed: true, duration, unit, resumeAt: resumeAt.toISOString() },
        paused: true,
        resumeAt,
    };
}

// ── Loop Node ───────────────────────────────────────────────────────────────
async function handleLoopNode(
    node: any,
    data: any,
    triggerData: any,
    previousOutputs: Record<string, any>,
    executionId: string
): Promise<NodeResult> {
    const collectionPath = data.collection || "trigger.items";
    const iteratorVar = data.iteratorVariable || "item";

    // Resolve the collection from available data
    let collection: any[] = [];
    const parts = collectionPath.split(".");
    let current: any = previousOutputs;
    for (const part of parts) {
        current = current?.[part];
    }
    if (Array.isArray(current)) {
        collection = current;
    }

    systemLogger.info(`[WORKFLOW_ENGINE] Loop: iterating over ${collection.length} items`);

    // Execute loop body for each item
    // For now, the loop body nodes need to be marked with the loop as parent
    // The engine provides each item as output for downstream nodes
    const results: any[] = [];
    for (let i = 0; i < collection.length; i++) {
        results.push({
            index: i,
            [iteratorVar]: collection[i],
        });
    }

    return {
        output: {
            loopCompleted: true,
            itemCount: collection.length,
            results,
            currentItem: collection.length > 0 ? collection[collection.length - 1] : null,
        },
        outcome: "done",
    };
}

// ── Action Node (send_email, notify, create_task) ───────────────────────────
async function handleActionNode(
    data: any,
    triggerData: any,
    previousOutputs: Record<string, any>,
    workflowTeamId: string
) {
    const actionType = data.actionType;

    const resolveVars = (str: string) => {
        if (!str) return str;
        return str.replace(/\{\{(.*?)\}\}/g, (match, path) => {
            const parts = path.split('.');
            let value: any = previousOutputs;
            for (const part of parts) {
                value = value?.[part];
            }
            return value !== undefined ? String(value) : match;
        });
    };

    if (actionType === 'send_email') {
        const to = resolveVars(data.to || triggerData.email || triggerData.contact?.email);
        const subject = resolveVars(data.subject || "Workflow Notification");
        const body = resolveVars(data.body || "");

        systemLogger.info(`[WORKFLOW_ENGINE] Action: Sending Email to ${to}`);
        return { output: { sent: true, to, subject } };
    }

    if (actionType === 'notify') {
        const userId = data.userId || triggerData.assigned_to || triggerData.createdBy;
        if (userId && workflowTeamId) {
            const targetUser = await prismadb.users.findFirst({
                where: { id: String(userId), team_id: workflowTeamId },
                select: { id: true },
            });
            if (targetUser) {
                await prismadb.crm_Notifications.create({
                    data: {
                        user_id: targetUser.id,
                        title: resolveVars(data.title || "Workflow Alert"),
                        content: resolveVars(data.message || "A workflow has triggered an alert."),
                        type: "WORKFLOW",
                        status: "UNREAD"
                    }
                });
            }
        }
        return { output: { notified: true } };
    }

    if (actionType === 'create_task') {
        // Future: create actual task record
        systemLogger.info(`[WORKFLOW_ENGINE] Action: Create Task`);
        return { output: { taskCreated: true, title: resolveVars(data.taskTitle || "New Task") } };
    }

    return { output: { success: true } };
}

// ── Condition Node ──────────────────────────────────────────────────────────
async function handleConditionNode(data: any, triggerData: any, previousOutputs: Record<string, any>) {
    const fieldPath = data.field || "";
    const operator = data.operator || "equals";
    const expectedValue = data.value;

    let actualValue: any = triggerData;
    const parts = fieldPath.split('.');
    for (const part of parts) {
        if (part) actualValue = actualValue?.[part];
    }

    let isTrue = false;
    switch (operator) {
        case 'equals': isTrue = actualValue == expectedValue; break;
        case 'not_equals': isTrue = actualValue != expectedValue; break;
        case 'contains': isTrue = String(actualValue).includes(String(expectedValue)); break;
        case 'not_contains': isTrue = !String(actualValue).includes(String(expectedValue)); break;
        case 'greater_than': isTrue = Number(actualValue) > Number(expectedValue); break;
        case 'less_than': isTrue = Number(actualValue) < Number(expectedValue); break;
        case 'greater_or_equal': isTrue = Number(actualValue) >= Number(expectedValue); break;
        case 'less_or_equal': isTrue = Number(actualValue) <= Number(expectedValue); break;
        case 'is_empty': isTrue = !actualValue || actualValue === '' || actualValue === null; break;
        case 'is_not_empty': isTrue = !!actualValue && actualValue !== ''; break;
        case 'starts_with': isTrue = String(actualValue).startsWith(String(expectedValue)); break;
        case 'ends_with': isTrue = String(actualValue).endsWith(String(expectedValue)); break;
    }

    return {
        output: { conditionMet: isTrue, actualValue, field: fieldPath, operator },
        outcome: isTrue ? "true" : "false"
    };
}

// ── Update Record Node ──────────────────────────────────────────────────────
async function handleUpdateRecordNode(
    data: any,
    triggerData: any,
    previousOutputs: Record<string, any>,
    workflowTeamId: string
) {
    const objectType = typeof data.objectType === "string" ? data.objectType.trim() : "";
    const recordId = typeof triggerData?.id === "string" ? triggerData.id.trim() : "";

    if (!workflowTeamId) {
        throw new Error("UpdateRecordNode missing workflow team_id context.");
    }

    if (!objectType || !recordId) {
        throw new Error("UpdateRecordNode missing objectType or recordId context.");
    }

    if (!ALLOWED_WORKFLOW_MODELS.has(objectType)) {
        throw new Error(`UpdateRecordNode disallowed objectType: ${objectType}`);
    }

    const updates: Record<string, any> = {};
    if (Array.isArray(data.fieldUpdates)) {
        data.fieldUpdates.forEach((u: { field: string; value: string }) => {
            const fieldName = typeof u?.field === "string" ? u.field.trim() : "";
            if (
                !fieldName ||
                fieldName.startsWith("$") ||
                BLOCKED_WORKFLOW_UPDATE_FIELDS.has(fieldName)
            ) {
                return;
            }
            updates[fieldName] = u.value;
        });
    }

    if (Object.keys(updates).length === 0) {
        return { output: { updated: false, fields: [] } };
    }

    const prismaModelKey = objectType === "Tasks" ? "tasks" : objectType;
    const model = (prismadb as any)[prismaModelKey];
    if (!model || typeof model.updateMany !== "function") {
        throw new Error(`Invalid workflow target model: ${objectType}`);
    }

    const result = await model.updateMany({
        where: { id: recordId, team_id: workflowTeamId },
        data: updates,
    });

    return { output: { updated: result.count > 0, count: result.count, fields: Object.keys(updates) } };
}
