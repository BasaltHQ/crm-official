import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { SUBSCRIPTION_PLANS, resolveSlug } from "@/config/subscriptions";
import { resolveBillingTeamId } from "@/lib/team-billing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UsageType = "email" | "sms" | "voice";

export interface QuotaCheckResult {
    allowed: boolean;
    remaining: number;
    limit: number;
    teamUsed: number;
    userUsed?: number;
    userLimit?: number;
    message?: string;
}

// ---------------------------------------------------------------------------
// Team Usage Quota — Get or Create for Current Period
// ---------------------------------------------------------------------------

function getPeriodStart(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function getOrCreateTeamQuota(teamId: string) {
    const periodStart = getPeriodStart();

    let quota = await prismadb.teamUsageQuota.findFirst({
        where: { team_id: teamId, period_start: periodStart },
        include: { user_allocations: true },
    });

    if (!quota) {
        quota = await prismadb.teamUsageQuota.create({
            data: {
                team_id: teamId,
                emails_used: 0,
                sms_used: 0,
                voice_minutes_used: 0,
                period_start: periodStart,
            },
            include: { user_allocations: true },
        });
    }

    return quota;
}

// ---------------------------------------------------------------------------
// Plan Limit Lookup
// ---------------------------------------------------------------------------

function getPlanLimit(planSlug: string | null | undefined, type: UsageType): number {
    const key = resolveSlug(planSlug);
    const limits = SUBSCRIPTION_PLANS[key]?.limits;
    if (!limits) return 0;

    switch (type) {
        case "email": return limits.emails_per_month;
        case "sms": return limits.sms_per_month;
        case "voice": return limits.voice_minutes_per_month;
    }
}

// ---------------------------------------------------------------------------
// Two-Tier Quota Check
// ---------------------------------------------------------------------------

/**
 * SOC2 A1.2: Enforce per-tenant and per-user usage quotas.
 * 
 * Layer 1: Team-level hard cap from subscription plan.
 * Layer 2: Optional per-user soft cap from admin-configured allocations.
 * 
 * @param teamId - The team's ID
 * @param userId - The acting user's ID (null for cron/system calls)
 * @param type - "email" | "sms" | "voice"
 * @param quantity - Number of units to check (default 1)
 */
export async function checkUsageQuota(
    teamId: string,
    userId: string | null,
    type: UsageType,
    quantity: number = 1
): Promise<QuotaCheckResult> {
    try {
        const billingTeamId = await resolveBillingTeamId(teamId);

        // 1. Get parent/billing team's plan
        const team = await prismadb.team.findUnique({
            where: { id: billingTeamId },
            select: {
                assigned_plan: { select: { slug: true } },
                subscription_plan: true, // Deprecated enum fallback
            },
        });

        if (!team) {
            return {
                allowed: false,
                remaining: 0,
                limit: 0,
                teamUsed: 0,
                message: "Billing organization not found.",
            };
        }

        const planSlug = team.assigned_plan?.slug || team.subscription_plan || "STARTER";
        const limit = getPlanLimit(planSlug, type);

        // -1 = unlimited
        if (limit === -1) {
            return { allowed: true, remaining: -1, limit: -1, teamUsed: 0 };
        }

        // 0 = feature blocked
        if (limit === 0) {
            return {
                allowed: false,
                remaining: 0,
                limit: 0,
                teamUsed: 0,
                message: `${type.toUpperCase()} is not included in your ${resolveSlug(planSlug)} plan. Please upgrade to access this feature.`,
            };
        }

        // 2. Get current period usage on parent/billing team
        const quota = await getOrCreateTeamQuota(billingTeamId);
        const teamUsed = getUsedCount(quota, type);
        const teamRemaining = limit - teamUsed;

        // 3. Check team hard cap
        if (teamUsed + quantity > limit) {
            return {
                allowed: false,
                remaining: Math.max(0, teamRemaining),
                limit,
                teamUsed,
                message: `Monthly ${type} limit reached (${teamUsed}/${limit}). Upgrade your plan for more.`,
            };
        }

        // 4. Check per-user soft cap (if configured)
        if (userId && quota.user_allocations?.length > 0) {
            const userAlloc = quota.user_allocations.find(
                (a: any) => a.user_id === userId
            );

            if (userAlloc) {
                const userLimit = getUserAllocLimit(userAlloc, type);
                // -1 = no user-level limit (shares pool freely)
                if (userLimit !== -1) {
                    const userUsed = getUserAllocUsed(userAlloc, type);

                    if (userLimit === 0) {
                        return {
                            allowed: false,
                            remaining: 0,
                            limit,
                            teamUsed,
                            userUsed,
                            userLimit,
                            message: `Your admin has restricted your ${type} access. Contact your team administrator.`,
                        };
                    }

                    if (userUsed + quantity > userLimit) {
                        return {
                            allowed: false,
                            remaining: Math.max(0, userLimit - userUsed),
                            limit,
                            teamUsed,
                            userUsed,
                            userLimit,
                            message: `Your personal ${type} limit reached (${userUsed}/${userLimit}). Contact your team administrator.`,
                        };
                    }
                }
            }
        }

        return {
            allowed: true,
            remaining: Math.max(0, teamRemaining),
            limit,
            teamUsed,
        };
    } catch (error) {
        systemLogger.error("[USAGE_QUOTA_CHECK_ERROR]", error);
        // Fail closed on quota check failure
        return {
            allowed: false,
            remaining: 0,
            limit: 0,
            teamUsed: 0,
            message: "Unable to verify usage quota at this time. Please try again.",
        };
    }
}

// ---------------------------------------------------------------------------
// Record Usage — Increment Counters After Successful Send
// ---------------------------------------------------------------------------

/**
 * Increment usage counters for team and (optionally) user.
 * Call this AFTER a successful send, not before.
 */
export async function recordUsage(
    teamId: string,
    userId: string | null,
    type: UsageType,
    quantity: number = 1
): Promise<void> {
    try {
        const billingTeamId = await resolveBillingTeamId(teamId);
        const periodStart = getPeriodStart();

        // Upsert team-level quota
        const teamIncrement = getIncrementField(type);
        await prismadb.teamUsageQuota.upsert({
            where: {
                team_id_period_start: {
                    team_id: billingTeamId,
                    period_start: periodStart,
                },
            },
            update: {
                [teamIncrement]: { increment: quantity },
            },
            create: {
                team_id: billingTeamId,
                period_start: periodStart,
                emails_used: type === "email" ? quantity : 0,
                sms_used: type === "sms" ? quantity : 0,
                voice_minutes_used: type === "voice" ? quantity : 0,
            },
        });

        // Increment user allocation counter (if exists)
        if (userId) {
            const quota = await prismadb.teamUsageQuota.findFirst({
                where: { team_id: billingTeamId, period_start: periodStart },
            });

            if (quota) {
                const userAlloc = await prismadb.teamUserAllocation.findFirst({
                    where: { quota_id: quota.id, user_id: userId },
                });

                if (userAlloc) {
                    const userField = getUserIncrementField(type);
                    await prismadb.teamUserAllocation.update({
                        where: { id: userAlloc.id },
                        data: { [userField]: { increment: quantity } },
                    });
                }
            }
        }
    } catch (error) {
        systemLogger.error("[USAGE_RECORD_ERROR]", error);
        // Don't throw — usage recording failure should not block sends
    }
}

// ---------------------------------------------------------------------------
// Admin: Set Per-User Allocation
// ---------------------------------------------------------------------------

/**
 * Team OWNER/ADMIN can set per-user soft caps.
 * Creates the allocation record if it doesn't exist.
 */
export async function setUserAllocation(
    teamId: string,
    targetUserId: string,
    allocations: Partial<{
        email_limit: number;
        sms_limit: number;
        voice_minutes_limit: number;
        ai_tokens_limit: number;
    }>
): Promise<void> {
    const billingTeamId = await resolveBillingTeamId(teamId);

    // Ensure team quota exists
    const quota = await getOrCreateTeamQuota(billingTeamId);

    await prismadb.teamUserAllocation.upsert({
        where: {
            quota_id_user_id: {
                quota_id: quota.id,
                user_id: targetUserId,
            },
        },
        update: allocations,
        create: {
            quota_id: quota.id,
            user_id: targetUserId,
            email_limit: allocations.email_limit ?? -1,
            sms_limit: allocations.sms_limit ?? -1,
            voice_minutes_limit: allocations.voice_minutes_limit ?? -1,
            ai_tokens_limit: allocations.ai_tokens_limit ?? -1,
            emails_used: 0,
            sms_used: 0,
            voice_minutes_used: 0,
        },
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUsedCount(quota: any, type: UsageType): number {
    switch (type) {
        case "email": return quota.emails_used || 0;
        case "sms": return quota.sms_used || 0;
        case "voice": return quota.voice_minutes_used || 0;
    }
}

function getIncrementField(type: UsageType): string {
    switch (type) {
        case "email": return "emails_used";
        case "sms": return "sms_used";
        case "voice": return "voice_minutes_used";
    }
}

function getUserAllocLimit(alloc: any, type: UsageType): number {
    switch (type) {
        case "email": return alloc.email_limit ?? -1;
        case "sms": return alloc.sms_limit ?? -1;
        case "voice": return alloc.voice_minutes_limit ?? -1;
    }
}

function getUserAllocUsed(alloc: any, type: UsageType): number {
    switch (type) {
        case "email": return alloc.emails_used || 0;
        case "sms": return alloc.sms_used || 0;
        case "voice": return alloc.voice_minutes_used || 0;
    }
}

function getUserIncrementField(type: UsageType): string {
    switch (type) {
        case "email": return "emails_used";
        case "sms": return "sms_used";
        case "voice": return "voice_minutes_used";
    }
}
