import { prismadb } from "@/lib/prisma";
import { resolveBillingTeamId } from "@/lib/team-billing";
import { SUBSCRIPTION_PLANS, resolveSlug } from "@/config/subscriptions";

/**
 * Manages Lead Generation credits for teams.
 * Credits are "Use-it-or-lose-it" and expire every month.
 * Monthly reset happens based on the team's subscription plan.
 * Unlimited status is determined strictly from the team's resolved plan (Enterprise / Exempt).
 */

async function resolveLeadGenPlanInfo(billingTeamId: string): Promise<{
    isUnlimited: boolean;
    monthlyAllowance: number;
}> {
    const team = await prismadb.team.findUnique({
        where: { id: billingTeamId },
        include: { assigned_plan: true },
    });

    const canonicalSlug = resolveSlug(
        team?.assigned_plan?.slug || (team as any)?.subscription_plan
    );

    if (canonicalSlug === "EXEMPT" || canonicalSlug === "ENTERPRISE") {
        return { isUnlimited: true, monthlyAllowance: -1 };
    }

    let monthlyAllowance = SUBSCRIPTION_PLANS.STARTER.limits.leadgen_credits;
    if (team?.assigned_plan) {
        const dbAllowance = team.assigned_plan.leadgen_credits_monthly;
        if (typeof dbAllowance === "number" && dbAllowance > 0) {
            monthlyAllowance = dbAllowance;
        } else {
            monthlyAllowance =
                SUBSCRIPTION_PLANS[canonicalSlug]?.limits?.leadgen_credits ??
                SUBSCRIPTION_PLANS.STARTER.limits.leadgen_credits;
        }
    } else {
        monthlyAllowance =
            SUBSCRIPTION_PLANS[canonicalSlug]?.limits?.leadgen_credits ??
            SUBSCRIPTION_PLANS.STARTER.limits.leadgen_credits;
    }

    if (monthlyAllowance < 0) {
        return { isUnlimited: true, monthlyAllowance: -1 };
    }

    return { isUnlimited: false, monthlyAllowance };
}

export async function getTeamLeadGenCredits(teamId: string): Promise<number> {
    const billingTeamId = await resolveBillingTeamId(teamId);
    const planInfo = await resolveLeadGenPlanInfo(billingTeamId);

    if (planInfo.isUnlimited) {
        return -1;
    }

    const config = await (prismadb as any).teamAiConfig.findUnique({
        where: { team_id: billingTeamId },
        select: {
            leadgen_credits_balance: true,
            leadgen_credits_last_reset: true
        }
    });

    if (!config) {
        return await resetLeadGenCredits(billingTeamId);
    }

    // Check if reset is needed (monthly)
    const now = new Date();
    const lastReset = config.leadgen_credits_last_reset || new Date(0);

    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        return await resetLeadGenCredits(billingTeamId);
    }

    // Never treat an accidental negative balance on a metered plan as unlimited (-1)
    return Math.max(0, config.leadgen_credits_balance ?? 0);
}

export async function resetLeadGenCredits(teamId: string): Promise<number> {
    const billingTeamId = await resolveBillingTeamId(teamId);
    const { isUnlimited, monthlyAllowance } = await resolveLeadGenPlanInfo(billingTeamId);

    const targetBalance = isUnlimited ? -1 : Math.max(0, monthlyAllowance);

    const updated = await (prismadb as any).teamAiConfig.upsert({
        where: { team_id: billingTeamId },
        update: {
            leadgen_credits_balance: targetBalance,
            leadgen_credits_last_reset: new Date()
        },
        create: {
            team_id: billingTeamId,
            leadgen_credits_balance: targetBalance,
            leadgen_credits_last_reset: new Date()
        }
    });

    return isUnlimited ? -1 : updated.leadgen_credits_balance;
}

export async function consumeLeadGenCredits(teamId: string, amount: number): Promise<number> {
    const billingTeamId = await resolveBillingTeamId(teamId);
    const planInfo = await resolveLeadGenPlanInfo(billingTeamId);

    if (planInfo.isUnlimited) {
        return -1;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        return await getTeamLeadGenCredits(billingTeamId);
    }

    const current = await getTeamLeadGenCredits(billingTeamId);
    if (current < amount) {
        throw new Error(`Insufficient LeadGen credits. Required ${amount}, available ${current}.`);
    }

    // Atomic conditional decrement to prevent TOCTOU race conditions and negative balance collisions
    const result = await prismadb.teamAiConfig.updateMany({
        where: {
            team_id: billingTeamId,
            leadgen_credits_balance: { gte: amount },
        },
        data: {
            leadgen_credits_balance: {
                decrement: amount,
            },
        },
    });

    if (result.count === 0) {
        const latest = await prismadb.teamAiConfig.findUnique({
            where: { team_id: billingTeamId },
            select: { leadgen_credits_balance: true },
        });
        const available = Math.max(0, latest?.leadgen_credits_balance ?? 0);
        throw new Error(`Insufficient LeadGen credits. Required ${amount}, available ${available}.`);
    }

    const updated = await prismadb.teamAiConfig.findUnique({
        where: { team_id: billingTeamId },
        select: { leadgen_credits_balance: true },
    });

    return Math.max(0, updated?.leadgen_credits_balance ?? current - amount);
}

export async function addLeadGenCredits(teamId: string, amount: number): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) return;

    const billingTeamId = await resolveBillingTeamId(teamId);
    const planInfo = await resolveLeadGenPlanInfo(billingTeamId);

    // Do NOT overwrite -1 unlimited balances on Enterprise / Exempt plans
    if (planInfo.isUnlimited) {
        return;
    }

    const existing = await prismadb.teamAiConfig.findUnique({
        where: { team_id: billingTeamId },
        select: { leadgen_credits_balance: true },
    });

    if (existing && existing.leadgen_credits_balance < 0) {
        await prismadb.teamAiConfig.update({
            where: { team_id: billingTeamId },
            data: { leadgen_credits_balance: amount },
        });
        return;
    }

    await prismadb.teamAiConfig.upsert({
        where: { team_id: billingTeamId },
        update: {
            leadgen_credits_balance: {
                increment: amount,
            },
        },
        create: {
            team_id: billingTeamId,
            leadgen_credits_balance: Math.max(0, planInfo.monthlyAllowance) + amount,
            leadgen_credits_last_reset: new Date(),
        },
    });
}
