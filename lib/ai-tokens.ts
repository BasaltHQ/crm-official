import { prismadb } from "@/lib/prisma";
import { resolveBillingTeamId } from "@/lib/team-billing";
import { SUBSCRIPTION_PLANS, resolveSlug } from "@/config/subscriptions";

/**
 * AI Token Balance Service
 * 
 * Manages per-team AI token balances with monthly auto-refill and top-up support.
 * Follows the same pattern as lib/scraper/credits.ts (leadgen credits).
 * 
 * Balance rules:
 * - Tokens refill from plan allowance at the start of each month (use-it-or-lose-it)
 * - Top-ups add to the current balance (don't carry over after monthly reset)
 * - Unlimited status is determined strictly from the team's resolved plan (Enterprise / Exempt)
 */

async function resolveTeamAiPlanInfo(billingTeamId: string): Promise<{
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

    let monthlyAllowance = 0;
    if (team?.assigned_plan) {
        const dbIncluded = (team.assigned_plan as any).ai_tokens_included;
        if (typeof dbIncluded === "number" && dbIncluded > 0) {
            monthlyAllowance = dbIncluded;
        } else {
            monthlyAllowance =
                SUBSCRIPTION_PLANS[canonicalSlug]?.limits?.ai_tokens ??
                SUBSCRIPTION_PLANS.STARTER.limits.ai_tokens;
        }
    } else {
        monthlyAllowance =
            SUBSCRIPTION_PLANS[canonicalSlug]?.limits?.ai_tokens ??
            SUBSCRIPTION_PLANS.STARTER.limits.ai_tokens;
    }

    if (monthlyAllowance < 0) {
        return { isUnlimited: true, monthlyAllowance: -1 };
    }

    return { isUnlimited: false, monthlyAllowance };
}

// ---------------------------------------------------------------------------
// Get Balance (with auto-reset)
// ---------------------------------------------------------------------------

export async function getTeamAiTokenBalance(teamId: string): Promise<number> {
    const billingTeamId = await resolveBillingTeamId(teamId);
    const planInfo = await resolveTeamAiPlanInfo(billingTeamId);

    if (planInfo.isUnlimited) {
        return -1;
    }

    const config = await (prismadb as any).teamAiConfig.findUnique({
        where: { team_id: billingTeamId },
        select: {
            ai_token_balance: true,
            ai_tokens_last_reset: true,
        },
    });

    if (!config) {
        return await resetAiTokenBalance(billingTeamId);
    }

    // Check if monthly reset is needed
    const now = new Date();
    const lastReset = config.ai_tokens_last_reset || new Date(0);

    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        return await resetAiTokenBalance(billingTeamId);
    }

    // Never treat an accidental negative balance on a metered plan as unlimited (-1)
    return Math.max(0, config.ai_token_balance ?? 0);
}

// ---------------------------------------------------------------------------
// Monthly Reset
// ---------------------------------------------------------------------------

export async function resetAiTokenBalance(teamId: string): Promise<number> {
    const billingTeamId = await resolveBillingTeamId(teamId);
    const { isUnlimited, monthlyAllowance } = await resolveTeamAiPlanInfo(billingTeamId);

    const targetBalance = isUnlimited ? -1 : Math.max(0, monthlyAllowance);

    const updated = await (prismadb as any).teamAiConfig.upsert({
        where: { team_id: billingTeamId },
        update: {
            ai_token_balance: targetBalance,
            ai_tokens_last_reset: new Date(),
        },
        create: {
            team_id: billingTeamId,
            ai_token_balance: targetBalance,
            ai_tokens_last_reset: new Date(),
        },
    });

    return isUnlimited ? -1 : updated.ai_token_balance;
}

// ---------------------------------------------------------------------------
// Consume Tokens
// ---------------------------------------------------------------------------

export async function consumeAiTokens(teamId: string, amount: number): Promise<number> {
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const billingTeamId = await resolveBillingTeamId(teamId);
    const planInfo = await resolveTeamAiPlanInfo(billingTeamId);

    // Unlimited plan (Enterprise / Exempt) — do not decrement
    if (planInfo.isUnlimited) {
        return -1;
    }

    const current = await getTeamAiTokenBalance(billingTeamId);
    if (current < amount) {
        throw new Error(`Insufficient AI tokens. Required ${amount}, available ${current}.`);
    }

    // Atomic conditional decrement to prevent TOCTOU race conditions and negative balance collisions
    const result = await (prismadb as any).teamAiConfig.updateMany({
        where: {
            team_id: billingTeamId,
            ai_token_balance: { gte: amount },
        },
        data: {
            ai_token_balance: {
                decrement: amount,
            },
        },
    });

    if (result.count === 0) {
        const latest = await (prismadb as any).teamAiConfig.findUnique({
            where: { team_id: billingTeamId },
            select: { ai_token_balance: true },
        });
        const available = Math.max(0, latest?.ai_token_balance ?? 0);
        throw new Error(`Insufficient AI tokens. Required ${amount}, available ${available}.`);
    }

    const updated = await (prismadb as any).teamAiConfig.findUnique({
        where: { team_id: billingTeamId },
        select: { ai_token_balance: true },
    });

    return Math.max(0, updated?.ai_token_balance ?? current - amount);
}

// ---------------------------------------------------------------------------
// Top-Up
// ---------------------------------------------------------------------------

export async function topUpAiTokens(teamId: string, amount: number): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) return;

    const billingTeamId = await resolveBillingTeamId(teamId);
    const planInfo = await resolveTeamAiPlanInfo(billingTeamId);

    // Do NOT overwrite -1 unlimited balances on Enterprise / Exempt plans
    if (planInfo.isUnlimited) {
        return;
    }

    const existing = await (prismadb as any).teamAiConfig.findUnique({
        where: { team_id: billingTeamId },
        select: { ai_token_balance: true },
    });

    if (existing && existing.ai_token_balance < 0) {
        await (prismadb as any).teamAiConfig.update({
            where: { team_id: billingTeamId },
            data: { ai_token_balance: amount },
        });
        return;
    }

    await (prismadb as any).teamAiConfig.upsert({
        where: { team_id: billingTeamId },
        update: {
            ai_token_balance: {
                increment: amount,
            },
        },
        create: {
            team_id: billingTeamId,
            ai_token_balance: Math.max(0, planInfo.monthlyAllowance) + amount,
            ai_tokens_last_reset: new Date(),
        },
    });
}
