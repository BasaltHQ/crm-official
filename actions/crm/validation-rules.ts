"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";

// ============================================================================
// VALIDATION RULE CRUD
// ============================================================================

export async function getValidationRules(teamId: string, objectType?: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");

        const effectiveTeamId = teamInfo.isPlatformAdmin && teamId ? teamId : teamInfo.teamId;
        if (!effectiveTeamId || effectiveTeamId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(effectiveTeamId)) {
            return [];
        }
        if (teamId && !validateResourceOwnership(teamInfo.teamId, teamId, teamInfo.isPlatformAdmin)) {
            return [];
        }

        const where: { team_id: string; object_type?: string } = { team_id: effectiveTeamId };
        if (objectType) where.object_type = objectType;

        const rules = await prismadb.validationRule.findMany({
            where,
            orderBy: [{ object_type: 'asc' }, { order: 'asc' }],
            include: {
                creator: { select: { id: true, name: true, avatar: true } },
            },
        });

        return rules;
    } catch (error) {
        console.error("Error fetching validation rules:", error);
        return [];
    }
}

export async function getValidationRule(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");

        const rule = await prismadb.validationRule.findUnique({
            where: { id },
            include: {
                creator: { select: { id: true, name: true, avatar: true } },
            },
        });

        if (!rule) return null;
        if (!validateResourceOwnership(teamInfo.teamId, rule.team_id, teamInfo.isPlatformAdmin)) {
            return null;
        }

        return rule;
    } catch (error) {
        console.error("Error fetching validation rule:", error);
        return null;
    }
}

interface CreateValidationRuleData {
    name: string;
    description?: string;
    object_type: string;
    formula: string;
    error_message: string;
    trigger_on?: string;
    is_active?: boolean;
    order?: number;
    team_id: string;
}

export async function createValidationRule(data: CreateValidationRuleData) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) throw new Error("Unauthorized");

        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
            return { success: false, error: "Forbidden — admin privileges required" };
        }

        const effectiveTeamId = teamInfo.isPlatformAdmin && data.team_id ? data.team_id : teamInfo.teamId;
        if (!effectiveTeamId) {
            return { success: false, error: "No team context" };
        }
        if (data.team_id && !validateResourceOwnership(teamInfo.teamId, data.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const rule = await prismadb.validationRule.create({
            data: {
                name: data.name,
                description: data.description,
                object_type: data.object_type,
                formula: data.formula,
                error_message: data.error_message,
                trigger_on: data.trigger_on || "SAVE",
                is_active: data.is_active ?? true,
                order: data.order ?? 0,
                team_id: effectiveTeamId,
                createdBy: session.user.id,
            },
        });

        revalidatePath('/crm/validation-rules');
        return { success: true, rule };
    } catch (error) {
        console.error("Error creating validation rule:", error);
        return { success: false, error: "Failed to create validation rule" };
    }
}

interface UpdateValidationRuleData {
    name?: string;
    description?: string;
    object_type?: string;
    formula?: string;
    error_message?: string;
    trigger_on?: string;
    is_active?: boolean;
    order?: number;
}

export async function updateValidationRule(id: string, data: UpdateValidationRuleData) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");
        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
            return { success: false, error: "Forbidden" };
        }

        const existing = await prismadb.validationRule.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing || !validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const rule = await prismadb.validationRule.update({
            where: { id },
            data,
        });

        revalidatePath('/crm/validation-rules');
        return { success: true, rule };
    } catch (error) {
        console.error("Error updating validation rule:", error);
        return { success: false, error: "Failed to update validation rule" };
    }
}

export async function deleteValidationRule(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");
        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
            return { success: false, error: "Forbidden" };
        }

        const existing = await prismadb.validationRule.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing || !validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        await prismadb.validationRule.delete({ where: { id } });

        revalidatePath('/crm/validation-rules');
        return { success: true };
    } catch (error) {
        console.error("Error deleting validation rule:", error);
        return { success: false, error: "Failed to delete validation rule" };
    }
}

export async function toggleValidationRule(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");
        if (!teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
            return { success: false, error: "Forbidden" };
        }

        const existing = await prismadb.validationRule.findUnique({ where: { id } });
        if (!existing) return { success: false, error: "Rule not found" };
        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const rule = await prismadb.validationRule.update({
            where: { id },
            data: { is_active: !existing.is_active },
        });

        revalidatePath('/crm/validation-rules');
        return { success: true, rule };
    } catch (error) {
        console.error("Error toggling validation rule:", error);
        return { success: false, error: "Failed to toggle validation rule" };
    }
}
