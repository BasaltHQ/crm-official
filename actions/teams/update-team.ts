"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import {
    isReservedTeamSlug,
    normalizeRoleName,
    normalizeTeamSlug,
    requirePlatformAdmin,
} from "@/lib/security/authz";

// @ts-ignore
import { SubscriptionPlan } from "@prisma/client";
import { systemLogger } from "@/lib/logger";

export const updateTeam = async (
    teamId: string,
    data: {
        name?: string;
        slug?: string;
        owner_id?: string;
        subscription_plan?: SubscriptionPlan;
        plan_id?: string;
    }
) => {
    try {
        const [currentUser, platformAdmin] = await Promise.all([
            getCurrentUserTeamId(),
            requirePlatformAdmin(),
        ]);

        if (!currentUser?.userId && !platformAdmin) {
            return { error: "Unauthorized" };
        }

        // Platform admins can modify any team; tenant admins can only modify their own team
        if (!platformAdmin && (currentUser?.teamId !== teamId || !currentUser?.isAdmin)) {
            return { error: "Unauthorized: You do not have permission to modify this team." };
        }

        const existingTeam = await prismadb.team.findUnique({
            where: { id: teamId },
            select: {
                id: true,
                slug: true,
                owner_id: true,
                plan_id: true,
                subscription_plan: true,
            },
        });

        if (!existingTeam) {
            return { error: "Team not found" };
        }

        const rawData = (data || {}) as Record<string, any>;
        const restrictedFields = [
            "plan_id",
            "subscription_plan",
            "module_overrides",
            "status",
            "renewal_date",
            "team_type",
            "parent_id",
        ];

        if (!platformAdmin) {
            const attemptedRestricted = restrictedFields.some(
                (field) => rawData[field] !== undefined
            );
            if (attemptedRestricted) {
                return {
                    error: "Forbidden: Only platform admins can modify subscription plans or system fields.",
                };
            }
        }

        // Explicitly whitelist allowed fields — never spread raw client data
        const updateData: Record<string, any> = {};

        if (data.name !== undefined) {
            const trimmedName = String(data.name).trim();
            if (!trimmedName) {
                return { error: "Team name cannot be empty" };
            }
            updateData.name = trimmedName;
        }

        if (data.slug !== undefined) {
            const normalizedSlug = normalizeTeamSlug(data.slug);
            if (!normalizedSlug) {
                return { error: "Invalid slug" };
            }
            if (
                !platformAdmin &&
                (isReservedTeamSlug(data.slug) || isReservedTeamSlug(normalizedSlug))
            ) {
                return { error: "Reserved team slug cannot be used" };
            }

            const existingSlugTeam = await prismadb.team.findFirst({
                where: {
                    slug: { equals: normalizedSlug, mode: "insensitive" },
                    id: { not: teamId },
                },
            });
            if (existingSlugTeam) {
                return { error: "Slug already exists" };
            }
            updateData.slug = normalizedSlug;
        }

        if (data.owner_id !== undefined && data.owner_id !== existingTeam.owner_id) {
            let isCurrentOwner = existingTeam.owner_id === currentUser?.userId;
            if (!isCurrentOwner && !platformAdmin && currentUser?.userId) {
                const callerDb = await prismadb.users.findUnique({
                    where: { id: currentUser.userId },
                    select: { team_id: true, team_role: true },
                });
                isCurrentOwner =
                    callerDb?.team_id === teamId &&
                    normalizeRoleName(callerDb?.team_role) === "OWNER";
            }

            if (!platformAdmin && !isCurrentOwner) {
                return {
                    error: "Forbidden: Only the current team owner or a platform admin can transfer ownership.",
                };
            }

            const targetMember = await prismadb.users.findFirst({
                where: { id: data.owner_id, team_id: teamId },
                select: { id: true },
            });
            if (!targetMember) {
                return { error: "Owner must be a member of this team" };
            }
            updateData.owner_id = targetMember.id;
        }

        // ── Platform-Admin-only subscription plan sync ──
        let planActuallyChanged = false;
        if (platformAdmin) {
            if (data.plan_id) {
                const plan = await prismadb.plan.findUnique({ where: { id: data.plan_id } });
                if (!plan) {
                    return { error: "Invalid plan selected" };
                }
                updateData.plan_id = plan.id;
                updateData.subscription_plan = plan.slug as any;
                planActuallyChanged =
                    existingTeam.plan_id !== plan.id ||
                    String(existingTeam.subscription_plan || "").toUpperCase() !==
                        String(plan.slug).toUpperCase();
            } else if (data.subscription_plan) {
                const plan = await prismadb.plan.findFirst({
                    where: { slug: { equals: String(data.subscription_plan), mode: "insensitive" } },
                });
                const resolvedPlanSlug = plan ? plan.slug : data.subscription_plan;
                updateData.subscription_plan = resolvedPlanSlug as any;
                if (plan) {
                    updateData.plan_id = plan.id;
                }
                planActuallyChanged =
                    (plan ? existingTeam.plan_id !== plan.id : false) ||
                    String(existingTeam.subscription_plan || "").toUpperCase() !==
                        String(resolvedPlanSlug || "").toUpperCase();
            }
        }

        const team = await (prismadb as any).team.update({
            where: {
                id: teamId,
            },
            data: updateData,
        });

        // ── Plan changed by Platform Admin → top up credits to the new plan's allowances ──
        if (platformAdmin && planActuallyChanged) {
            try {
                const { resetLeadGenCredits } = await import("@/lib/scraper/credits");
                const { resetAiTokenBalance } = await import("@/lib/ai-tokens");
                await resetLeadGenCredits(teamId);
                await resetAiTokenBalance(teamId);
                systemLogger.info("[UPDATE_TEAM] Credits topped up after plan change", {
                    teamId,
                    newPlan: updateData.subscription_plan,
                });
            } catch (err) {
                systemLogger.error("[UPDATE_TEAM] Failed to reset credits after plan change:", err);
                // Non-fatal — the plan was still updated successfully
            }
        }

        revalidatePath(`/partners/${teamId}`);
        revalidatePath("/partners");
        return { success: true, team };
    } catch (error) {
        systemLogger.error("[UPDATE_TEAM]", error);
        return { error: "Failed to update team" };
    }
};
