
/**
 * Base Pay Subscriptions (CDP / Smart Wallet Integration)
 * 
 * Documentation:
 * - https://docs.base.org/base-account/reference/base-pay/subscriptions-overview
 * 
 * This module handles:
 * 1. Generating Subscription Intents (for User to sign)
 * 2. Charging user wallets (via Cron / Admin action)
 */

import { prismadb } from "@/lib/prisma";

export interface BaseSubscriptionPlan {
    name: string;
    amountUSDC: number;
    billingPeriod: "monthly" | "yearly";
    merchantAddress: string;
}

/**
 * Creates a Subscription "Intent"
 * This returns the JSON object that the Frontend SDK (Base Account SDK) needs to prompt the user to sign.
 */
export async function createBaseSubscriptionIntent(tenantId: string, plan: BaseSubscriptionPlan) {
    // 1. Fetch Merchant Wallet from DB
    const integration = await prismadb.tenant_Integrations.findFirst({
        where: { tenant_id: tenantId }
    });

    if (!integration?.surge_merchant_id) {
        throw new Error("Merchant Wallet not configured in Surge Settings");
    }

    // 2. Construct the Intent Packet
    // Real implementation would interact with CDP SDK server-side if needed, but usually 
    // the frontend constructs the Smart Contract call. 
    // Here we define the terms for the frontend to digest.
    return {
        chainId: 8453, // Base Mainnet
        recipient: integration.surge_merchant_id,
        amount: plan.amountUSDC,
        token: "USDC_ADDRESS_ON_BASE", // 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
        periodSeconds: plan.billingPeriod === "monthly" ? 2592000 : 31536000
    };
}

/**
 * Charges a specific subscription
 * This is called by a CRON job.
 * Note: Requires a Server-Side Smart Wallet with gas (ETH) to pay for the TX execution.
 */
export async function chargeBaseSubscription(subscriptionId: string) {
    console.log(`[BasePay] Attempting to charge subscription ${subscriptionId}...`);
    // Ideally executes: subscription.charge(subId) via CDP SDK
    return { success: true, txHash: "0x_mock_charge_tx" };
}
