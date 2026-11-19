"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { addLeadGenCredits } from "@/lib/scraper/credits";
import { resolveBillingTeamId } from "@/lib/team-billing";
import { SUBSCRIPTION_PLANS, resolveSlug } from "@/config/subscriptions";
import { systemLogger } from "@/lib/logger";

const ONBOARDING_BONUS_CREDITS = 25;
const BONUS_KEY = "onboarding_bonus_claimed";

const ALLOWED_MILESTONES = new Set([
    "first_lead",
    "first_account",
    "first_contact",
    "first_campaign",
    "first_opportunity",
    "first_call",
    "first_outreach_email",
    "profile_completed",
    "email_verified",
    "onboarding_complete",
    "quick_launch_complete",
]);

/**
 * Awards bonus LeadGen credits when a STARTER (Free) user completes onboarding milestones.
 * 
 * Rules:
 * - Milestone must belong to explicit ALLOWED_MILESTONES allowlist
 * - Resolves DEPARTMENT to parent billing organization
 * - Only awarded ONCE per milestone per billing organization (persisted in TeamAiConfig.configuration BEFORE crediting)
 * - Only for STARTER / FREE plan organizations
 */
export async function claimOnboardingBonus(milestone: string) {
    try {
        if (!milestone || typeof milestone !== "string") {
            return { success: false, error: "Invalid milestone" };
        }

        const normalizedMilestone = milestone.trim().toLowerCase();
        if (!ALLOWED_MILESTONES.has(normalizedMilestone)) {
            return { success: false, error: "Unsupported onboarding milestone" };
        }

        const session = await getServerSession(authOptions);
        if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
            return { success: false, error: "Not authenticated" };
        }

        const dbUser = await prismadb.users.findUnique({
            where: { id: session.user.id },
            select: { team_id: true, userStatus: true },
        });

        if (!dbUser?.team_id || dbUser.userStatus === "INACTIVE") {
            return { success: false, error: "Not authenticated or no team assigned" };
        }

        const billingTeamId = await resolveBillingTeamId(dbUser.team_id);

        // 1. Fetch billing team to check plan
        const team = await prismadb.team.findUnique({
            where: { id: billingTeamId },
            select: {
                subscription_plan: true,
                slug: true,
                assigned_plan: { select: { slug: true } },
            },
        });

        if (!team) {
            return { success: false, error: "Team not found" };
        }

        // 2. Only award to STARTER (legacy FREE) plan teams (paid/exempt already have generous allocations)
        const internalSlugs = ["basalthq", "basalt", "ledger1"];
        const resolvedPlan = resolveSlug(team.assigned_plan?.slug || team.subscription_plan);
        if (
            internalSlugs.includes((team.slug || "").toLowerCase()) ||
            resolvedPlan !== "STARTER"
        ) {
            return {
                success: false,
                error: "Bonus only available for Starter plan users",
                alreadyPaid: true,
            };
        }

        // 3. Check if bonus was already claimed (idempotent) inside TeamAiConfig.configuration
        const config = await prismadb.teamAiConfig.findUnique({
            where: { team_id: billingTeamId },
            select: { configuration: true },
        });

        const existingConfiguration =
            config?.configuration &&
            typeof config.configuration === "object" &&
            !Array.isArray(config.configuration)
                ? (config.configuration as Record<string, any>)
                : {};

        const claimedMilestones =
            existingConfiguration.onboarding_bonuses &&
            typeof existingConfiguration.onboarding_bonuses === "object" &&
            !Array.isArray(existingConfiguration.onboarding_bonuses)
                ? (existingConfiguration.onboarding_bonuses as Record<string, any>)
                : {};

        const bonusKey = `${BONUS_KEY}_${normalizedMilestone}`;
        if (existingConfiguration[bonusKey] || claimedMilestones[normalizedMilestone]) {
            return {
                success: false,
                error: "Bonus already claimed for this milestone",
                alreadyClaimed: true,
            };
        }

        // 4. Persist claim state inside TeamAiConfig.configuration BEFORE crediting!
        const claimedAt = new Date().toISOString();
        const updatedConfiguration = {
            ...existingConfiguration,
            [bonusKey]: claimedAt,
            onboarding_bonuses: {
                ...claimedMilestones,
                [normalizedMilestone]: claimedAt,
            },
        };

        await prismadb.teamAiConfig.upsert({
            where: { team_id: billingTeamId },
            update: {
                configuration: updatedConfiguration,
            },
            create: {
                team_id: billingTeamId,
                leadgen_credits_balance: SUBSCRIPTION_PLANS.STARTER.limits.leadgen_credits,
                leadgen_credits_last_reset: new Date(),
                configuration: updatedConfiguration,
            },
        });

        // 5. Award the credits
        await addLeadGenCredits(billingTeamId, ONBOARDING_BONUS_CREDITS);

        systemLogger.info(
            `[ONBOARDING_BONUS] Awarded ${ONBOARDING_BONUS_CREDITS} credits to team ${billingTeamId} for milestone: ${normalizedMilestone}`
        );

        return {
            success: true,
            creditsAwarded: ONBOARDING_BONUS_CREDITS,
            milestone: normalizedMilestone,
            message: `🎉 You earned ${ONBOARDING_BONUS_CREDITS} bonus LeadGen credits!`,
        };
    } catch (error) {
        systemLogger.error("[ONBOARDING_BONUS] Error:", error);
        return { success: false, error: "Failed to claim bonus credits" };
    }
}
