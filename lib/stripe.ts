import Stripe from "stripe";
import { prismadb } from "@/lib/prisma";
import { SUBSCRIPTION_PLANS, SubscriptionPlanType, AI_TOKEN_TOPUP } from "@/config/subscriptions";
import { systemLogger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Stripe Client
// ---------------------------------------------------------------------------

if (!process.env.STRIPE_API_KEY) {
    console.warn("[Stripe] STRIPE_API_KEY is not set. Stripe features will be unavailable.");
}

export const stripe = new Stripe(process.env.STRIPE_API_KEY || "sk_test_placeholder", {
    apiVersion: "2026-02-25.clover",
    typescript: true,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Get or create a Stripe Customer for a team.
 * Stores the customer ID in crm_Subscriptions.
 */
export async function getOrCreateStripeCustomer(
    teamId: string,
    email: string,
    teamName?: string
): Promise<string> {
    // Check if we already have a Stripe customer
    const sub = await prismadb.crm_Subscriptions.findUnique({
        where: { tenant_id: teamId },
    });

    if (sub?.stripe_customer_id) {
        return sub.stripe_customer_id;
    }

    // Create a new Stripe customer
    const customer = await stripe.customers.create({
        email,
        name: teamName || undefined,
        metadata: {
            team_id: teamId,
        },
    });

    // Store it (upsert in case subscription record doesn't exist yet)
    await prismadb.crm_Subscriptions.upsert({
        where: { tenant_id: teamId },
        create: {
            tenant_id: teamId,
            stripe_customer_id: customer.id,
            payment_provider: "STRIPE",
            customer_email: email,
            plan_name: "STARTER",
            amount: 0,
            billing_day: new Date().getDate(),
            interval: "monthly",
            next_billing_date: new Date(),
            status: "PENDING",
        },
        update: {
            stripe_customer_id: customer.id,
        },
    });

    return customer.id;
}

// ---------------------------------------------------------------------------
// Price Resolution — uses pre-created Stripe Price IDs from env
// ---------------------------------------------------------------------------

/**
 * Stripe prices are pre-created by scripts/seed-stripe.ts.
 * Env vars: STRIPE_PRICE_{PLAN_SLUG}_MONTHLY, STRIPE_PRICE_{PLAN_SLUG}_ANNUAL
 */
function getStripePriceId(planSlug: string, interval: "monthly" | "annual"): string | null {
    const envKey = `STRIPE_PRICE_${planSlug.toUpperCase()}_${interval.toUpperCase()}`;
    const priceId = process.env[envKey];

    if (!priceId) {
        console.warn(`[Stripe] No price ID found for ${envKey}. Run: npx tsx scripts/seed-stripe.ts`);
        return null;
    }

    return priceId;
}

// ---------------------------------------------------------------------------
// Checkout Sessions
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout Session for a subscription plan.
 * Uses pre-created Stripe Price IDs (managed by Stripe).
 */
export async function createStripeCheckoutSession(
    teamId: string,
    email: string,
    planSlug: string,
    interval: "monthly" | "annual",
    teamName?: string,
    quantity: number = 1
) {
    try {
        const customerId = await getOrCreateStripeCustomer(teamId, email, teamName);

        const priceId = getStripePriceId(planSlug, interval);

        // Build line items - use price ID if available, fallback to inline price_data
        let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

        if (priceId) {
            lineItems = [{ price: priceId, quantity }];
        } else {
            // Fallback: inline price_data (for migration before seed-stripe is run)
            const plan = SUBSCRIPTION_PLANS[planSlug as SubscriptionPlanType];
            if (!plan || plan.price === 0) {
                throw new Error(`No pricing data for plan: ${planSlug}`);
            }
            const unitAmount = interval === "annual"
                ? Math.round(plan.price * 12 * 0.80 * 100)
                : plan.price * 100;
            lineItems = [{
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `Basalt CRM — ${plan.name}`,
                        description: `${plan.name} Plan (${interval === "annual" ? "Annual" : "Monthly"})`,
                    },
                    unit_amount: unitAmount,
                    recurring: {
                        interval: (interval === "annual" ? "year" : "month") as Stripe.Price.Recurring.Interval,
                    },
                },
                quantity,
            }];
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: "subscription",
            line_items: lineItems,
            success_url: `${APP_URL}/admin/billing?session_id={CHECKOUT_SESSION_ID}&status=success`,
            cancel_url: `${APP_URL}/admin/billing?status=cancelled`,
            metadata: {
                team_id: teamId,
                plan_slug: planSlug,
                interval,
            },
            subscription_data: {
                metadata: {
                    team_id: teamId,
                    plan_slug: planSlug,
                },
            },
        });

        return session;
    } catch (error) {
        systemLogger.error("[Stripe] Failed to create checkout session", error);
        throw error;
    }
}

/**
 * Create a Stripe Checkout Session for a one-time AI token top-up.
 * Uses pre-created Stripe Price ID if available.
 */
export async function createStripeTopUpSession(
    teamId: string,
    email: string,
    teamName?: string
) {
    try {
        const customerId = await getOrCreateStripeCustomer(teamId, email, teamName);

        const topUpPriceId = process.env.STRIPE_PRICE_AI_TOPUP;

        let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];

        if (topUpPriceId) {
            lineItems = [{ price: topUpPriceId, quantity: 1 }];
        } else {
            // Fallback: inline price_data
            lineItems = [{
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: "AI Token Top-Up",
                        description: `${(AI_TOKEN_TOPUP.tokens / 1_000_000).toFixed(0)}M additional AI tokens`,
                    },
                    unit_amount: Math.round(AI_TOKEN_TOPUP.price * 100),
                },
                quantity: 1,
            }];
        }

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: "payment",
            line_items: lineItems,
            success_url: `${APP_URL}/admin/billing?topup=success`,
            cancel_url: `${APP_URL}/admin/billing?topup=cancelled`,
            metadata: {
                team_id: teamId,
                type: "AI_TOKEN_TOPUP",
                tokens: AI_TOKEN_TOPUP.tokens.toString(),
            },
        });

        return session;
    } catch (error) {
        systemLogger.error("[Stripe] Failed to create top-up session", error);
        throw error;
    }
}

/**
 * Create a Stripe Customer Portal session for managing subscriptions.
 */
export async function createStripePortalSession(customerId: string) {
    try {
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${APP_URL}/admin/billing`,
        });

        return session;
    } catch (error) {
        systemLogger.error("[Stripe] Failed to create portal session", error);
        throw error;
    }
}
