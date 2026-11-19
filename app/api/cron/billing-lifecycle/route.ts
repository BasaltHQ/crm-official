import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { stripe } from "@/lib/stripe";
import { requireCronAuth } from "@/lib/api-auth-guard";

/**
 * GET /api/cron/billing-lifecycle
 * 
 * Scheduled daily via Vercel Cron or similar.
 * Implements grace periods for STRIPE payments:
 * - 7 days since payment_failed_at: Soft Disable -> `status = 'SUSPENDED'`
 * - 30 days since payment_failed_at: Hard Disable -> Downgrade to STARTER mode
 */
export async function GET(req: Request) {
    try {
        const cronAuth = requireCronAuth(req);
        if (cronAuth instanceof Response) return cronAuth;

        systemLogger.info("[CRON_BILLING] Starting sweep for expired subscriptions...");

        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);

        // 1. Hard Disable (Downgrade) - Runs first to skip soft disabling things that will just be downgraded.
        // Identify teams where payment_provider == 'STRIPE' AND payment_failed_at <= thirtyDaysAgo
        const pendingDowngrade = await prismadb.crm_Subscriptions.findMany({
            where: {
                payment_provider: "STRIPE",
                payment_failed_at: { lte: thirtyDaysAgo }
            },
            select: { tenant_id: true, stripe_subscription_id: true }
        });

        const downgradedTeams = pendingDowngrade.map((sub: { tenant_id: string, stripe_subscription_id: string | null }) => sub);

        let downgradedCount = 0;
        const freePlan = await prismadb.plan.findFirst({
            where: { slug: "STARTER" },
        });

        for (const teamInfo of downgradedTeams) {
            const teamId = teamInfo.tenant_id;
            try {
                // IMPORTANT: Perfectly map to Stripe API by actively canceling any orphaned live subscriptions
                if (teamInfo.stripe_subscription_id) {
                    try {
                        await stripe.subscriptions.cancel(teamInfo.stripe_subscription_id);
                        systemLogger.info(`[CRON_BILLING] Effectively cancelled Stripe Native Subscription ${teamInfo.stripe_subscription_id}`);
                    } catch (stripeErr: any) {
                        systemLogger.warn(`[CRON_BILLING] Stripe native subscription likely already cancelled. Skipping. ${stripeErr.message}`);
                    }
                }

                // Perform a downgrade instead of a deletion.
                await prismadb.crm_Subscriptions.update({
                    where: { tenant_id: teamId },
                    data: {
                        status: "CANCELLED",
                        stripe_subscription_id: null,
                        plan_name: "STARTER",
                        amount: 0,
                    },
                });

                if (freePlan) {
                    await prismadb.team.update({
                        where: { id: teamId },
                        data: {
                            plan_id: freePlan.id,
                            subscription_plan: "STARTER",
                            status: "ACTIVE" // remove suspended lock since they are now on the free tier safely
                        },
                    });
                }
                
                downgradedCount++;
                systemLogger.info(`[CRON_BILLING] Downgrade applied. Downgraded team ${teamId} to STARTER after >30 days of payment failure.`);
            } catch (err: any) {
                systemLogger.error(`[CRON_BILLING] Failed to downgrade team ${teamId}: ${err.message}`);
            }
        }

        // 2. Soft Disable (Suspension)
        // Identify teams where payment_provider == 'STRIPE' AND payment_failed_at <= sevenDaysAgo AND payment_failed_at > thirtyDaysAgo
        // We ensure we only fetch teams that weren't just deleted.
        const pendingSuspension = await prismadb.crm_Subscriptions.findMany({
            where: {
                payment_provider: "STRIPE",
                payment_failed_at: {
                    lte: sevenDaysAgo,
                    gt: thirtyDaysAgo
                },
                // Avoid those we just downgraded (if they failed for some reason)
                tenant_id: { notIn: downgradedTeams.map((t: { tenant_id: string }) => t.tenant_id) }
            },
            select: { tenant_id: true }
        });

        const suspendedTeamIds = pendingSuspension.map((sub: { tenant_id: string }) => sub.tenant_id);

        let suspendedCount = 0;
        if (suspendedTeamIds.length > 0) {
            const result = await prismadb.team.updateMany({
                where: {
                    id: { in: suspendedTeamIds },
                    status: { not: "SUSPENDED" } // only update if not already suspended
                },
                data: { status: "SUSPENDED" }
            });
            
            // Also sync it on the subscription record
            await prismadb.crm_Subscriptions.updateMany({
                where: { tenant_id: { in: suspendedTeamIds } },
                data: { status: "SUSPENDED" }
            });

            suspendedCount = result.count;
            systemLogger.info(`[CRON_BILLING] Soft Disable applied. Suspended ${suspendedCount} teams after >7 days of payment failure.`);
        }

        return NextResponse.json({
            success: true,
            hardDowngraded: downgradedCount,
            softSuspended: suspendedCount,
            message: "Billing sweep complete"
        });

    } catch (error: any) {
        systemLogger.error("[CRON_BILLING] Error during billing sweep", error.message);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
