"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addMonths } from "date-fns";
import { createSurgeCheckoutSession } from "@/lib/surge";
import { createStripeCheckoutSession } from "@/lib/stripe";
import { systemLogger } from "@/lib/logger";
import { sendSmsSetupInstructions } from "@/lib/email/sms-setup-instructions";
import {
    SUBSCRIPTION_PLANS,
    SURGE_DISCOUNT_PERCENT,
    getAnnualPrice,
    getMonthlyPrice,
    resolveSlug,
} from "@/config/subscriptions";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { isSelfServicePlanSlug, requirePlatformAdmin } from "@/lib/security/authz";

export async function saveSubscription(data: {
    planName: string;
    amount: number;
    billingDay: number;
    customerWallet?: string;
    discountApplied: boolean;
    interval: "monthly" | "annual";
    paymentProvider?: "STRIPE" | "SURGE";
}) {
    try {
        const [session, teamInfo] = await Promise.all([
            getServerSession(authOptions),
            getCurrentUserTeamId(),
        ]);
        if (!session?.user?.id || !teamInfo?.teamId) {
            return { error: "Unauthorized" };
        }

        if (!teamInfo.isAdmin) {
            return { error: "Forbidden: Only team admins can manage subscriptions." };
        }

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id }
        });

        if (!user) {
            return { error: "User not found" };
        }

        // Resolve department to parent organization if needed
        const rawTeam = await prismadb.team.findUnique({
            where: { id: teamInfo.teamId },
            select: { id: true, slug: true, name: true, parent_id: true, team_type: true }
        });

        if (!rawTeam) {
            return { error: "Team not found" };
        }

        const team =
            rawTeam.team_type === "DEPARTMENT" && rawTeam.parent_id
                ? await prismadb.team.findUnique({
                      where: { id: rawTeam.parent_id },
                      select: { id: true, slug: true, name: true },
                  })
                : rawTeam;

        if (!team) {
            return { error: "Billing organization not found" };
        }

        const teamId = team.id;
        const provider = data.paymentProvider || "SURGE";
        const interval: "monthly" | "annual" = data.interval === "annual" ? "annual" : "monthly";

        const isInternalSlug = ["basalt", "basalthq", "ledger1"].includes(team.slug.toLowerCase());
        const platformAdmin = isInternalSlug ? await requirePlatformAdmin() : null;
        const isInternalTeam = isInternalSlug && Boolean(platformAdmin);

        const planSlug = resolveSlug(data.planName);
        if (!isInternalTeam && !isSelfServicePlanSlug(planSlug)) {
            return { error: "Selected plan is not available for self-service subscription." };
        }

        const canonicalPlan = SUBSCRIPTION_PLANS[planSlug];
        const baseAmount =
            interval === "annual"
                ? getAnnualPrice(planSlug)
                : getMonthlyPrice(planSlug);

        // Apply 5% Surge discount on canonical server-computed price (never trust client data.amount)
        let finalAmount = baseAmount;
        let discountApplied = interval === "annual";

        if (provider === "SURGE") {
            finalAmount = Math.round(baseAmount * (1 - SURGE_DISCOUNT_PERCENT / 100) * 100) / 100;
            discountApplied = true;
        }

        // Hard gate: Surge billing must be explicitly enabled
        if (provider === "SURGE" && process.env.SURGE_BILLING_ENABLED !== "true") {
            return { error: "BasaltSurge billing is not enabled in this environment." };
        }

        // Calculate next billing date
        const safeBillingDay = Math.min(28, Math.max(1, Math.floor(Number(data.billingDay) || 1)));
        const now = new Date();
        let nextBillingDate = new Date(now.getFullYear(), now.getMonth(), safeBillingDay);

        const daysDiff = (nextBillingDate.getTime() - now.getTime()) / (1000 * 3600 * 24);

        if (daysDiff < 10) {
            if (interval === "annual") {
                nextBillingDate = addMonths(nextBillingDate, 12);
            } else {
                nextBillingDate = addMonths(nextBillingDate, 1);
            }
        } else {
            if (interval === "annual") {
                nextBillingDate = addMonths(nextBillingDate, 12);
            }
        }

        // =====================================================================
        // STRIPE PATH — Skip local subscription record creation.
        // The Stripe webhook (checkout.session.completed) handles subscription
        // creation + plan assignment AFTER payment is confirmed.
        // This prevents stale PENDING records when users cancel checkout.
        // =====================================================================
        if (provider === "STRIPE") {
            try {
                const checkoutSession = await createStripeCheckoutSession(
                    teamId,
                    user.email!,
                    planSlug,
                    interval,
                    team?.name
                );

                if (checkoutSession?.url) {
                    return { success: true, url: checkoutSession.url, provider: "STRIPE" };
                }
            } catch (stripeErr) {
                systemLogger.error("[SaveSubscription] Stripe checkout failed", stripeErr);
                return { error: "Stripe checkout session creation failed. Please try again." };
            }

            return { error: "Stripe checkout session creation failed (no URL returned)." };
        }

        // =====================================================================
        // SURGE PATH (below) — Create subscription record upfront for manual
        // payment since Surge uses an in-app payment modal, not an external redirect.
        // =====================================================================

        // Verified internal/exempt platform admin teams get ACTIVE immediately; everyone else starts PENDING
        // until payment is confirmed via Surge webhook
        const status = isInternalTeam ? "ACTIVE" : "PENDING_PAYMENT";
        const lastChargeStatus = isInternalTeam ? "SYSTEM_FREE_TIER" : "PENDING_FIRST_PAYMENT";

        // 1. Create/Update the Subscription Record (Surge only)
        const sub = await prismadb.crm_Subscriptions.upsert({
            where: { tenant_id: teamId },
            create: {
                tenant_id: teamId,
                customer_email: user.email,
                customer_wallet: data.customerWallet,
                discount_applied: discountApplied,
                payment_provider: provider,
                plan_name: canonicalPlan.name,
                amount: isInternalTeam ? 0 : finalAmount,
                billing_day: safeBillingDay,
                interval: interval,
                next_billing_date: nextBillingDate,
                status: status,
                last_charge_status: lastChargeStatus
            },
            update: {
                customer_email: user.email,
                customer_wallet: data.customerWallet,
                discount_applied: discountApplied,
                payment_provider: provider,
                plan_name: canonicalPlan.name,
                amount: isInternalTeam ? 0 : finalAmount,
                billing_day: safeBillingDay,
                interval: interval,
                next_billing_date: nextBillingDate,
                status: status,
                last_charge_status: lastChargeStatus
            }
        });

        // 2. Internal / Exempt Teams: handle early
        if (isInternalTeam) {
            systemLogger.info(`[SaveSubscription] Internal team ${team.slug} detected.`);
        }

        // 2.5 Send SMS/Email Setup Notification for Growth / Scale
        if (["GROWTH", "SCALE"].includes(planSlug)) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://basalthq.com";
            sendSmsSetupInstructions(user.email!, user.name!, canonicalPlan.name, appUrl).catch(e => {
                systemLogger.error(`[SaveSubscription] Failed to send SMS Setup Instructions to ${user.email}`, e);
            });
        }

        // =====================================================================
        // SURGE PATH — BasaltSurge checkout flow (5% discount applied)
        // =====================================================================

        // 3. Create Invoice & Checkout
        const invoice = await prismadb.invoices.create({
            data: {
                team_id: teamId,
                assigned_user_id: session.user.id,
                invoice_number: `SUB-${Date.now()}`,
                invoice_amount: finalAmount.toString(),
                invoice_currency: "USD",
                invoice_type: "SUBSCRIPTION",
                description: `Subscription: ${canonicalPlan.name} (${interval}) — BasaltSurge`,
                status: "UNPAID",
                payment_status: "UNPAID",
                invoice_file_mimeType: "application/pdf",
                invoice_file_url: ""
            }
        });

        systemLogger.info(`[SaveSubscription] Created invoice ${invoice.id} for subscription (${canonicalPlan.name}, $${finalAmount})`);

        // 3b. Also create a formal crm_BillingInvoice
        const periodStart = now;
        const periodEnd = interval === "annual" ? addMonths(now, 12) : addMonths(now, 1);

        await (prismadb as any).crm_BillingInvoice.create({
            data: {
                tenant_id: teamId,
                subscription_id: sub.id,
                invoice_number: `BIL-${invoice.invoice_number}`,
                type: "SUBSCRIPTION",
                description: `${canonicalPlan.name} Plan — ${interval === "annual" ? "Annual" : "Monthly"} (BasaltSurge -${SURGE_DISCOUNT_PERCENT}%)`,
                period_start: periodStart,
                period_end: periodEnd,
                subtotal: baseAmount,
                discount: Math.max(0, Math.round((baseAmount - finalAmount) * 100) / 100),
                tax: 0,
                total: finalAmount,
                payment_method: data.customerWallet ? "CRYPTO" : "SURGE",
                payment_status: "PENDING",
            }
        });

        // 3c. Generate Surge Checkout Session using platform Surge keys
        const checkoutSession = await createSurgeCheckoutSession(teamId, invoice, undefined, {
            forcePlatformKeys: true,
        });

        if (checkoutSession && checkoutSession.url) {
            await prismadb.invoices.update({
                where: { id: invoice.id },
                data: {
                    surge_payment_id: checkoutSession.id,
                    surge_payment_link: checkoutSession.url,
                    payment_status: "PENDING"
                }
            });
            return { success: true, url: checkoutSession.url, invoiceId: invoice.id, provider: "SURGE" };
        }

        systemLogger.error(`[SaveSubscription] createSurgeCheckoutSession returned null for invoice ${invoice.id}.`);

        if (isInternalTeam) {
            return { success: true, message: "Subscription updated (Internal Team — Surge Link Generation Skipped/Failed)" };
        }

        return { error: "Subscription updated, but payment link generation failed. Please check invoices." };

    } catch (error) {
        console.error("Failed to save subscription:", error);
        return { error: "Failed to save subscription" };
    }
}
