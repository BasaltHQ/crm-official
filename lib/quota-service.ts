import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { getTeamAiTokenBalance } from "@/lib/ai-tokens";
import { SUBSCRIPTION_PLANS, resolveSlug } from "@/config/subscriptions";
import { DECISION_SERVICES } from "@/lib/ai/reply-decisions";
import { resolveBillingTeamId } from "@/lib/team-billing";

export type QuotaResource = "LEADS" | "USERS" | "STORAGE" | "CREDITS" | "AI_TOKENS" | "CONTACTS" | "ACCOUNTS" | "OPPORTUNITIES";

/** Default CRM record limits per resource when no plan-level override exists */
const DEFAULT_CRM_LIMITS: Record<string, number> = {
    LEADS: 5000,
    CONTACTS: 5000,
    ACCOUNTS: 1000,
    OPPORTUNITIES: 1000,
};

function getStarterFallbackLimit(resource: QuotaResource): number {
    const starter = SUBSCRIPTION_PLANS.STARTER.limits;
    switch (resource) {
        case "USERS":
            return starter.max_users;
        case "STORAGE":
            return starter.max_storage;
        case "CREDITS":
            return starter.credits;
        case "AI_TOKENS":
            return starter.ai_tokens;
        default:
            return DEFAULT_CRM_LIMITS[resource] ?? 1000;
    }
}

async function resolveEffectivePlan(team: any) {
    const legacyPlan = (team as any)?.subscription_plan as string | undefined;
    const canonicalSlug = resolveSlug(team?.assigned_plan?.slug || legacyPlan);
    const canonicalConfig = SUBSCRIPTION_PLANS[canonicalSlug] || SUBSCRIPTION_PLANS.STARTER;

    if (team?.assigned_plan) {
        return { plan: team.assigned_plan, legacyPlan, canonicalSlug };
    }

    const dbPlan =
        (await prismadb.plan.findFirst({ where: { slug: canonicalSlug } })) ||
        (await prismadb.plan.findFirst({ where: { slug: "STARTER" } })) ||
        (await prismadb.plan.findFirst({ where: { slug: "FREE" } }));

    if (dbPlan) {
        return { plan: dbPlan, legacyPlan, canonicalSlug };
    }

    // Never fail open if Plan DB rows are missing — synthesize from canonical STARTER/plan config
    return {
        plan: {
            slug: canonicalConfig.slug,
            max_users: canonicalConfig.limits.max_users,
            max_storage: canonicalConfig.limits.max_storage,
            max_credits: canonicalConfig.limits.credits,
        },
        legacyPlan,
        canonicalSlug,
    };
}

/**
 * Resolve the effective CRM record limit for a given resource.
 * Priority: Plan DB field → Canonical SUBSCRIPTION_PLANS config → hardcoded default.
 * Returns -1 for unlimited.
 */
function resolveCrmLimit(plan: any, teamSubscriptionPlan: string | null | undefined, resource: QuotaResource): number {
    const canonicalSlug = resolveSlug(plan?.slug || teamSubscriptionPlan);
    const canonicalPlan = SUBSCRIPTION_PLANS[canonicalSlug];

    if (canonicalPlan) {
        const limits = canonicalPlan.limits;
        if (limits.max_users === -1 && limits.max_storage === -1 && limits.credits === -1) {
            return -1;
        }
    }

    const fieldName = `max_${resource.toLowerCase()}`;
    if (plan && typeof plan[fieldName] === "number") {
        return plan[fieldName];
    }

    return DEFAULT_CRM_LIMITS[resource] ?? 1000;
}

/**
 * Returns the exact numeric limit for a resource (returns -1 if unlimited).
 */
export async function getTeamQuotaLimit(teamId: string, resource: QuotaResource): Promise<number> {
    try {
        const billingTeamId = await resolveBillingTeamId(teamId);
        const team = await prismadb.team.findUnique({
            where: { id: billingTeamId },
            include: { assigned_plan: true }
        });

        if (!team) return 0;

        const { plan, legacyPlan, canonicalSlug } = await resolveEffectivePlan(team);
        if (canonicalSlug === "EXEMPT" || canonicalSlug === "ENTERPRISE") {
            return -1;
        }

        switch (resource) {
            case "USERS": {
                let limit = plan.max_users;
                if (limit !== -1) {
                    const sub = await prismadb.crm_Subscriptions.findFirst({
                        where: { tenant_id: billingTeamId, payment_provider: "STRIPE", status: "ACTIVE" },
                        select: { quantity: true }
                    });
                    if (sub && sub.quantity) {
                        limit = limit * sub.quantity;
                    }
                }
                return limit;
            }
            case "LEADS": return resolveCrmLimit(plan, legacyPlan, "LEADS");
            case "CONTACTS": return resolveCrmLimit(plan, legacyPlan, "CONTACTS");
            case "ACCOUNTS": return resolveCrmLimit(plan, legacyPlan, "ACCOUNTS");
            case "OPPORTUNITIES": return resolveCrmLimit(plan, legacyPlan, "OPPORTUNITIES");
            case "STORAGE": return plan.max_storage;
            case "CREDITS": return plan.max_credits;
            case "AI_TOKENS": return SUBSCRIPTION_PLANS[canonicalSlug]?.limits?.ai_tokens ?? SUBSCRIPTION_PLANS.STARTER.limits.ai_tokens;
            default: return getStarterFallbackLimit(resource);
        }
    } catch (error) {
        systemLogger.error("[QUOTA_LIMIT_ERROR]", error);
        return getStarterFallbackLimit(resource);
    }
}

/**
 * SOC2 A1.2: Enforce tenant-level resource quotas based on their subscription plan.
 * Prevents "Noisy Neighbor" resource exhaustion and subscription fraud.
 * Platform admins (is_admin) bypass all quota checks for testing purposes.
 * EXEMPT and ENTERPRISE plans bypass all CRM record quotas (unlimited).
 */
export async function checkTeamQuota(teamId: string, resource: QuotaResource, userId?: string): Promise<{ allowed: boolean; message?: string }> {
    try {
        // Admin bypass: platform superadmins always pass quota checks
        if (userId) {
            const requestingUser = await prismadb.users.findUnique({
                where: { id: userId },
                select: { is_admin: true }
            });
            if (requestingUser?.is_admin) {
                return { allowed: true };
            }
        }

        // Resolve DEPARTMENT parent_id to parent organization before checking plans/quotas
        const billingTeamId = await resolveBillingTeamId(teamId);

        const team = await prismadb.team.findUnique({
            where: { id: billingTeamId },
            include: { assigned_plan: true }
        });

        if (!team) return { allowed: false, message: "Team not found" };

        const { plan, legacyPlan, canonicalSlug } = await resolveEffectivePlan(team);

        if (canonicalSlug === "EXEMPT" || canonicalSlug === "ENTERPRISE") {
            return { allowed: true };
        }

        // Aggregate counts across parent org + child departments so department creation cannot multiply limits
        const childDepts = await prismadb.team.findMany({
            where: { parent_id: billingTeamId },
            select: { id: true },
        });
        const orgTeamIds = [billingTeamId, ...childDepts.map((d) => d.id)];

        switch (resource) {
            case "USERS": {
                const userCount = await prismadb.users.count({ where: { team_id: { in: orgTeamIds } } });
                let limit = plan.max_users;
                
                if (limit !== -1) {
                    const sub = await prismadb.crm_Subscriptions.findFirst({
                        where: { tenant_id: billingTeamId, payment_provider: "STRIPE", status: "ACTIVE" },
                        select: { quantity: true }
                    });
                    if (sub && sub.quantity) {
                        limit = limit * sub.quantity;
                    }
                }

                if (limit !== -1 && userCount >= limit) {
                    return { allowed: false, message: `User limit reached (${limit} users max configured with purchased seats)` };
                }
                break;
            }
            case "LEADS": {
                const limit = resolveCrmLimit(plan, legacyPlan, "LEADS");
                if (limit === -1) break;
                const leadCount = await (prismadb as any).crm_Leads.count({ where: { team_id: { in: orgTeamIds } } });
                if (leadCount >= limit) {
                    return { allowed: false, message: `Lead limit reached (${limit} leads max)` };
                }
                break;
            }
            case "CONTACTS": {
                const limit = resolveCrmLimit(plan, legacyPlan, "CONTACTS");
                if (limit === -1) break;
                const contactCount = await prismadb.crm_Contacts.count({ where: { team_id: { in: orgTeamIds } } });
                if (contactCount >= limit) {
                    return { allowed: false, message: `Contact limit reached (${limit} contacts max)` };
                }
                break;
            }
            case "ACCOUNTS": {
                const limit = resolveCrmLimit(plan, legacyPlan, "ACCOUNTS");
                if (limit === -1) break;
                const accountCount = await prismadb.crm_Accounts.count({ where: { team_id: { in: orgTeamIds } } });
                if (accountCount >= limit) {
                    return { allowed: false, message: `Account limit reached (${limit} accounts max)` };
                }
                break;
            }
            case "OPPORTUNITIES": {
                const limit = resolveCrmLimit(plan, legacyPlan, "OPPORTUNITIES");
                if (limit === -1) break;
                const opportunityCount = await prismadb.crm_Opportunities.count({ where: { team_id: { in: orgTeamIds } } });
                if (opportunityCount >= limit) {
                    return { allowed: false, message: `Opportunity limit reached (${limit} opportunities max)` };
                }
                break;
            }
            case "STORAGE": {
                if (plan.max_storage === -1) break;
                const docs = await prismadb.documents.aggregate({
                    where: { team_id: { in: orgTeamIds } },
                    _sum: { size: true }
                });
                const usedBytes = docs._sum.size || 0;
                const usedMB = usedBytes / (1024 * 1024);

                if (usedMB >= plan.max_storage) {
                    return { allowed: false, message: `Storage limit reached (${plan.max_storage} MB max)` };
                }
                break;
            }
            case "CREDITS": {
                const currentUsage = await prismadb.crm_AiUsageLog.count({
                    where: { tenant_id: { in: orgTeamIds }, service: { notIn: [...DECISION_SERVICES] } }
                });

                if (plan.max_credits !== -1 && currentUsage >= plan.max_credits) {
                    return { allowed: false, message: `AI Credit limit reached (${plan.max_credits} credits max). Upgrade your plan for more.` };
                }
                break;
            }
            case "AI_TOKENS": {
                const balance = await getTeamAiTokenBalance(billingTeamId);
                if (balance !== -1 && balance <= 0) {
                    return { allowed: false, message: "AI token balance exhausted. Top up or upgrade your plan." };
                }
                break;
            }
        }

        return { allowed: true };
    } catch (error) {
        systemLogger.error("[QUOTA_CHECK_ERROR]", error);
        return { allowed: false, message: "Unable to verify plan quota at this time. Please try again." };
    }
}
