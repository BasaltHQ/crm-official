"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addMonths } from "date-fns";
import { createSurgeCheckoutSession } from "@/lib/surge";

export async function saveSubscription(data: {
    planName: string;
    amount: number;
    billingDay: number;
    customerWallet?: string;
    discountApplied: boolean;
    interval: "monthly" | "annual";
}) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return { error: "Unauthorized" };
        }

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id }
        });

        if (!user || !user.team_id) {
            return { error: "User or Team not found" };
        }

        const teamId = user.team_id;

        // Calculate next billing date
        const now = new Date();
        let nextBillingDate = new Date(now.getFullYear(), now.getMonth(), data.billingDay);

        // If the billing day has already passed this month, move to next month
        if (nextBillingDate <= now) {
            nextBillingDate = addMonths(nextBillingDate, 1);
        }

        // 1. Create/Update the Subscription Record first (Pending Payment)
        await prismadb.crm_Subscriptions.upsert({
            where: { tenant_id: teamId },
            create: {
                tenant_id: teamId,
                customer_email: user.email,
                customer_wallet: data.customerWallet,
                discount_applied: data.discountApplied,
                plan_name: data.planName,
                amount: data.amount,
                billing_day: data.billingDay,
                interval: data.interval,
                next_billing_date: nextBillingDate,
                status: "ACTIVE", // Keeping active but tracking un-payment via other means or invoice
                last_charge_status: "PENDING_FIRST_PAYMENT"
            },
            update: {
                customer_email: user.email,
                customer_wallet: data.customerWallet,
                discount_applied: data.discountApplied,
                plan_name: data.planName,
                amount: data.amount,
                billing_day: data.billingDay,
                interval: data.interval,
                next_billing_date: nextBillingDate,
                status: "ACTIVE",
                last_charge_status: "PENDING_FIRST_PAYMENT"
            }
        });

        // 2. Create an Invoice for the first payment to generate the Surge Link
        // (This allows us to leverage Surge's Invoice Checkout flow for the first charge + vaulting)
        const invoice = await prismadb.invoices.create({
            data: {
                team_id: teamId,
                invoice_number: `SUB-${Date.now()}`,
                invoice_amount: data.amount.toString(),
                description: `Subscription: ${data.planName} (${data.interval})`,
                status: "UNPAID",
                payment_status: "UNPAID",
                invoice_file_mimeType: "application/pdf",
                invoice_file_url: ""
            }
        });

        // 3. Generate Surge Checkout Session
        const checkoutSession = await createSurgeCheckoutSession(teamId, invoice);

        if (checkoutSession && checkoutSession.url) {
            return { success: true, url: checkoutSession.url };
        }

        return { success: true, message: "Subscription updated, but payment link generation failed. Please check invoices." };

    } catch (error) {
        console.error("Failed to save subscription:", error);
        return { error: "Failed to save subscription" };
    }
}
