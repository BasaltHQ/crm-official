"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { normalizeRoleName } from "@/lib/security/authz";
import { revalidatePath } from "next/cache";
import { ApprovalProcessStatus, ApprovalRequestStatus, ApprovalAction, Prisma } from "@prisma/client";

const ALLOWED_APPROVAL_MODELS = new Set([
    "crm_Leads",
    "crm_Contacts",
    "crm_Accounts",
    "crm_Opportunities",
    "crm_Cases",
    "crm_Quotes",
    "crm_Contracts",
]);

const BLOCKED_APPROVAL_UPDATE_FIELDS = new Set([
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

function sanitizeApprovalUpdateData(raw: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [key, val] of Object.entries(raw || {})) {
        const trimmed = key.trim();
        if (!trimmed || trimmed.startsWith("$") || BLOCKED_APPROVAL_UPDATE_FIELDS.has(trimmed)) {
            continue;
        }
        out[trimmed] = val;
    }
    return out;
}

// ============================================================================
// APPROVAL PROCESS CRUD
// ============================================================================

export async function getApprovalProcesses(teamId: string, objectType?: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");

        const effectiveTeamId = teamInfo.isPlatformAdmin && teamId ? teamId : teamInfo.teamId;
        if (!effectiveTeamId || effectiveTeamId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(effectiveTeamId)) return [];

        if (teamId && !validateResourceOwnership(teamInfo.teamId, teamId, teamInfo.isPlatformAdmin)) {
            return [];
        }

        const where: { team_id: string; object_type?: string } = { team_id: effectiveTeamId };
        if (objectType) where.object_type = objectType;

        const processes = await prismadb.approvalProcess.findMany({
            where,
            orderBy: [{ object_type: 'asc' }, { order: 'asc' }],
            include: {
                creator: { select: { id: true, name: true, avatar: true } },
                steps: { orderBy: { step_number: 'asc' } },
                _count: { select: { requests: true } },
            },
        });

        return processes;
    } catch (error) {
        console.error("Error fetching approval processes:", error);
        return [];
    }
}

export async function getApprovalProcess(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");

        if (!id || id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(id)) return null;

        const process = await prismadb.approvalProcess.findUnique({
            where: { id },
            include: {
                creator: { select: { id: true, name: true, avatar: true } },
                steps: {
                    orderBy: { step_number: 'asc' },
                    include: {
                        approver_user: { select: { id: true, name: true, avatar: true } },
                    },
                },
                requests: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: {
                        submitter: { select: { id: true, name: true, avatar: true } },
                        actions: {
                            include: {
                                actor: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!process) return null;
        if (!validateResourceOwnership(teamInfo.teamId, process.team_id, teamInfo.isPlatformAdmin)) {
            return null;
        }

        return process;
    } catch (error) {
        console.error("Error fetching approval process:", error);
        return null;
    }
}

interface CreateApprovalProcessData {
    name: string;
    description?: string;
    object_type: string;
    entry_criteria?: string;
    final_approval_actions?: Prisma.InputJsonValue;
    final_rejection_actions?: Prisma.InputJsonValue;
    allow_recall?: boolean;
    lock_record?: boolean;
    order?: number;
    team_id: string;
    steps: {
        step_number: number;
        name: string;
        approver_type: string;
        approver_user_id?: string;
        approver_role?: string;
        approval_mode?: string;
        auto_escalate_hours?: number;
    }[];
}

export async function createApprovalProcess(data: CreateApprovalProcessData) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) throw new Error("Unauthorized");

        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
            return { success: false, error: "Forbidden — admin privileges required" };
        }

        if (!ALLOWED_APPROVAL_MODELS.has(data.object_type)) {
            return { success: false, error: `Unsupported object_type: ${data.object_type}` };
        }

        const effectiveTeamId = teamInfo.isPlatformAdmin && data.team_id ? data.team_id : teamInfo.teamId;
        if (!effectiveTeamId) {
            return { success: false, error: "No team context" };
        }
        if (data.team_id && !validateResourceOwnership(teamInfo.teamId, data.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const process = await prismadb.approvalProcess.create({
            data: {
                name: data.name,
                description: data.description,
                object_type: data.object_type,
                entry_criteria: data.entry_criteria,
                final_approval_actions: data.final_approval_actions ?? null,
                final_rejection_actions: data.final_rejection_actions ?? null,
                allow_recall: data.allow_recall ?? true,
                lock_record: data.lock_record ?? true,
                order: data.order ?? 0,
                team_id: effectiveTeamId,
                createdBy: session.user.id,
                status: ApprovalProcessStatus.DRAFT,
                steps: {
                    create: data.steps.map(step => ({
                        step_number: step.step_number,
                        name: step.name,
                        approver_type: step.approver_type,
                        approver_user_id: step.approver_user_id || undefined,
                        approver_role: step.approver_role || undefined,
                        approval_mode: step.approval_mode || "FIRST_RESPONSE",
                        auto_escalate_hours: step.auto_escalate_hours,
                    })),
                },
            },
            include: { steps: true },
        });

        revalidatePath('/crm/approvals');
        return { success: true, process };
    } catch (error) {
        console.error("Error creating approval process:", error);
        return { success: false, error: "Failed to create approval process" };
    }
}

export async function updateApprovalProcessStatus(id: string, status: ApprovalProcessStatus) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");
        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
            return { success: false, error: "Forbidden" };
        }

        if (!id || id.length !== 24) return { success: false, error: "Invalid process ID" };

        const existing = await prismadb.approvalProcess.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing || !validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const process = await prismadb.approvalProcess.update({
            where: { id },
            data: { status },
        });

        revalidatePath('/crm/approvals');
        return { success: true, process };
    } catch (error) {
        console.error("Error updating approval process status:", error);
        return { success: false, error: "Failed to update status" };
    }
}

export async function deleteApprovalProcess(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");
        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
            return { success: false, error: "Forbidden" };
        }

        if (!id || id.length !== 24) return { success: false, error: "Invalid process ID" };

        const existing = await prismadb.approvalProcess.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing || !validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        await prismadb.approvalRequestAction.deleteMany({
            where: { request: { process_id: id } },
        });
        await prismadb.approvalRequest.deleteMany({
            where: { process_id: id },
        });
        await prismadb.approvalStep.deleteMany({
            where: { process_id: id },
        });
        await prismadb.approvalProcess.delete({ where: { id } });

        revalidatePath('/crm/approvals');
        return { success: true };
    } catch (error) {
        console.error("Error deleting approval process:", error);
        return { success: false, error: "Failed to delete approval process" };
    }
}

export async function submitForApproval(data: {
    record_id: string;
    record_type: string;
    team_id: string;
    comment?: string;
    record_snapshot?: Prisma.InputJsonValue;
}) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) throw new Error("Unauthorized");

        if (!ALLOWED_APPROVAL_MODELS.has(data.record_type)) {
            return { success: false, error: "Unsupported record_type" };
        }

        const effectiveTeamId = teamInfo.isPlatformAdmin && data.team_id ? data.team_id : teamInfo.teamId;
        if (!effectiveTeamId || effectiveTeamId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(effectiveTeamId)) {
            return { success: false, error: "Invalid team ID" };
        }
        if (data.team_id && !validateResourceOwnership(teamInfo.teamId, data.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        // Verify target record belongs to effectiveTeamId
        const targetModel = (prismadb as any)[data.record_type];
        const targetRecord = await targetModel?.findFirst?.({
            where: { id: data.record_id, team_id: effectiveTeamId },
            select: { id: true },
        });
        if (!targetRecord) {
            return { success: false, error: "Record not found in your team" };
        }

        const process = await prismadb.approvalProcess.findFirst({
            where: {
                team_id: effectiveTeamId,
                object_type: data.record_type,
                status: ApprovalProcessStatus.ACTIVE,
            },
            include: {
                steps: { orderBy: { step_number: 'asc' } },
            },
            orderBy: { order: 'asc' },
        });

        if (!process) {
            return { success: false, error: "No active approval process found for this record type" };
        }

        if (process.steps.length === 0) {
            return { success: false, error: "Approval process has no steps configured" };
        }

        if (process.entry_criteria) {
            const { evaluateFormula } = await import("@/lib/validation-engine");
            const recordData = data.record_snapshot as Record<string, unknown> ?? {};
            const meetsCriteria = evaluateFormula(process.entry_criteria, recordData);
            if (!meetsCriteria) {
                return { success: false, error: "Record does not meet approval criteria" };
            }
        }

        const existing = await prismadb.approvalRequest.findFirst({
            where: {
                record_id: data.record_id,
                record_type: data.record_type,
                team_id: effectiveTeamId,
                status: ApprovalRequestStatus.PENDING,
            },
        });

        if (existing) {
            return { success: false, error: "This record already has a pending approval request" };
        }

        const request = await prismadb.approvalRequest.create({
            data: {
                process_id: process.id,
                record_id: data.record_id,
                record_type: data.record_type,
                submitted_by: session.user.id,
                submit_comment: data.comment,
                record_snapshot: data.record_snapshot ?? null,
                status: ApprovalRequestStatus.PENDING,
                current_step: 1,
                team_id: effectiveTeamId,
            },
        });

        revalidatePath('/crm/approvals');
        return { success: true, request };
    } catch (error) {
        console.error("Error submitting for approval:", error);
        return { success: false, error: "Failed to submit for approval" };
    }
}

export async function processApprovalAction(data: {
    request_id: string;
    action: ApprovalAction;
    comment?: string;
    reassign_to?: string;
}) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) throw new Error("Unauthorized");

        if (!data.request_id || data.request_id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(data.request_id)) {
            return { success: false, error: "Invalid request ID" };
        }

        const request = await prismadb.approvalRequest.findUnique({
            where: { id: data.request_id },
            include: {
                process: {
                    include: {
                        steps: { orderBy: { step_number: 'asc' } },
                    },
                },
            },
        });

        if (!request) {
            return { success: false, error: "Approval request not found" };
        }

        if (!validateResourceOwnership(teamInfo.teamId, request.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        if (request.status !== ApprovalRequestStatus.PENDING) {
            return { success: false, error: "This request is no longer pending" };
        }

        const currentStep = request.process.steps.find(
            (s: { step_number: number }) => s.step_number === request.current_step
        );
        if (!currentStep) {
            return { success: false, error: "Current approval step not found" };
        }

        // Verify actor authorization for this step / action
        if (data.action === ApprovalAction.RECALL) {
            if (request.submitted_by !== session.user.id && !teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
                return { success: false, error: "Forbidden — only the submitter or an admin can recall" };
            }
        } else if (!teamInfo.isPlatformAdmin && !teamInfo.isAdmin) {
            if (currentStep.approver_type === "SPECIFIC_USER" && currentStep.approver_user_id !== session.user.id) {
                return { success: false, error: "Forbidden — you are not the designated approver" };
            }
            if (
                currentStep.approver_type === "ROLE" &&
                currentStep.approver_role &&
                normalizeRoleName(teamInfo.teamRole) !== normalizeRoleName(currentStep.approver_role)
            ) {
                return { success: false, error: "Forbidden — insufficient role for this approval step" };
            }
        }

        await prismadb.approvalRequestAction.create({
            data: {
                request_id: request.id,
                step_id: currentStep.id,
                actor_id: session.user.id,
                action: data.action,
                comment: data.comment,
                reassigned_to: data.reassign_to,
            },
        });

        if (data.action === ApprovalAction.APPROVE) {
            const nextStep = request.process.steps.find(
                (s: { step_number: number }) => s.step_number === request.current_step + 1
            );

            if (nextStep) {
                await prismadb.approvalRequest.update({
                    where: { id: request.id },
                    data: { current_step: nextStep.step_number },
                });
            } else {
                await prismadb.approvalRequest.update({
                    where: { id: request.id },
                    data: {
                        status: ApprovalRequestStatus.APPROVED,
                        completedAt: new Date(),
                    },
                });

                if (
                    ALLOWED_APPROVAL_MODELS.has(request.record_type) &&
                    request.process.final_approval_actions &&
                    typeof request.process.final_approval_actions === 'object' &&
                    !Array.isArray(request.process.final_approval_actions)
                ) {
                    try {
                        const safeUpdateData = sanitizeApprovalUpdateData(
                            request.process.final_approval_actions as Record<string, any>
                        );
                        if (Object.keys(safeUpdateData).length > 0 && request.team_id) {
                            await (prismadb as any)[request.record_type].updateMany({
                                where: { id: request.record_id, team_id: request.team_id },
                                data: safeUpdateData,
                            });
                        }
                    } catch (err) {
                        console.error(`Failed to execute final approval actions for ${request.record_type} ${request.record_id}`, err);
                    }
                }
            }
        } else if (data.action === ApprovalAction.REJECT) {
            await prismadb.approvalRequest.update({
                where: { id: request.id },
                data: {
                    status: ApprovalRequestStatus.REJECTED,
                    completedAt: new Date(),
                },
            });

            if (
                ALLOWED_APPROVAL_MODELS.has(request.record_type) &&
                request.process.final_rejection_actions &&
                typeof request.process.final_rejection_actions === 'object' &&
                !Array.isArray(request.process.final_rejection_actions)
            ) {
                try {
                    const safeUpdateData = sanitizeApprovalUpdateData(
                        request.process.final_rejection_actions as Record<string, any>
                    );
                    if (Object.keys(safeUpdateData).length > 0 && request.team_id) {
                        await (prismadb as any)[request.record_type].updateMany({
                            where: { id: request.record_id, team_id: request.team_id },
                            data: safeUpdateData,
                        });
                    }
                } catch (err) {
                    console.error(`Failed to execute final rejection actions for ${request.record_type} ${request.record_id}`, err);
                }
            }
        } else if (data.action === ApprovalAction.RECALL) {
            if (!request.process.allow_recall) {
                return { success: false, error: "Recall is not allowed for this process" };
            }
            await prismadb.approvalRequest.update({
                where: { id: request.id },
                data: {
                    status: ApprovalRequestStatus.RECALLED,
                    completedAt: new Date(),
                },
            });
        }

        revalidatePath('/crm/approvals');
        return { success: true };
    } catch (error) {
        console.error("Error processing approval action:", error);
        return { success: false, error: "Failed to process approval action" };
    }
}

export async function getMyPendingApprovals(teamId?: string) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) throw new Error("Unauthorized");

        const effectiveTeamId = teamInfo.isPlatformAdmin && teamId ? teamId : teamInfo.teamId;
        if (!effectiveTeamId || effectiveTeamId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(effectiveTeamId)) {
            return [];
        }
        if (teamId && !validateResourceOwnership(teamInfo.teamId, teamId, teamInfo.isPlatformAdmin)) {
            return [];
        }

        const where: Prisma.ApprovalRequestWhereInput = {
            status: ApprovalRequestStatus.PENDING,
            team_id: effectiveTeamId,
        };

        const requests = await prismadb.approvalRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                process: {
                    include: {
                        steps: {
                            orderBy: { step_number: 'asc' },
                            include: {
                                approver_user: { select: { id: true, name: true, avatar: true } },
                            },
                        },
                    },
                },
                submitter: { select: { id: true, name: true, avatar: true } },
                actions: {
                    include: {
                        actor: { select: { id: true, name: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        const myRequests = requests.filter((req: any) => {
            const currentStep = req.process.steps.find((s: { step_number: number }) => s.step_number === req.current_step);
            if (!currentStep) return false;
            if (currentStep.approver_type === 'SPECIFIC_USER') {
                return currentStep.approver_user_id === session.user?.id;
            }
            if (currentStep.approver_type === 'ROLE') {
                if (!currentStep.approver_role) return teamInfo.isAdmin;
                return (
                    teamInfo.isAdmin ||
                    normalizeRoleName(teamInfo.teamRole) === normalizeRoleName(currentStep.approver_role)
                );
            }
            return false;
        });

        return myRequests;
    } catch (error) {
        console.error("Error fetching pending approvals:", error);
        return [];
    }
}

export async function getRecordApprovals(recordId: string, recordType: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");

        if (!recordId || recordId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(recordId)) return [];
        if (!teamInfo.teamId && !teamInfo.isPlatformAdmin) return [];

        const requests = await prismadb.approvalRequest.findMany({
            where: {
                record_id: recordId,
                record_type: recordType,
                ...(teamInfo.isPlatformAdmin && !teamInfo.teamId ? {} : { team_id: teamInfo.teamId! }),
            },
            orderBy: { createdAt: 'desc' },
            include: {
                process: { select: { name: true } },
                submitter: { select: { id: true, name: true, avatar: true } },
                actions: {
                    include: {
                        actor: { select: { id: true, name: true } },
                        step: { select: { name: true, step_number: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        return requests;
    } catch (error) {
        console.error("Error fetching record approvals:", error);
        return [];
    }
}
