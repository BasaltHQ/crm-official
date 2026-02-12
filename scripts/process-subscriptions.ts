import { prismadb } from "../lib/prisma";
import { chargeVaultedCard, getWalletBalance, chargeFromWallet, SurgeChargeResponse } from "../lib/surge-billing";
import { addMonths, startOfToday, subDays } from "date-fns";

/**
 * process-subscriptions.ts
 * 
 * THE COLLECTOR CRON JOB
 * This script scans for all active or overdue subscriptions and 
 * triggers the Surge Hybrid Rail charge.
 */

async function runCollector() {
    console.log("🚀 [Collector] Starting daily billing run...");

    const today = startOfToday();
    const threeDaysAgo = subDays(today, 3);

    // 1. Process Due Subscriptions (ACTIVE or OVERDUE but still within grace)
    const dueSubscriptions = await (prismadb as any).crm_Subscriptions.findMany({
        where: {
            status: { in: ["ACTIVE", "OVERDUE"] },
            next_billing_date: { lte: today },
        },
        include: {
            team: {
                include: {
                    integrations: true
                }
            }
        }
    });

    console.log(`📂 [Collector] Found ${dueSubscriptions.length} subscriptions due for billing.`);

    for (const sub of dueSubscriptions) {
        try {
            // SKIP PLATFORM TEAMS (BasaltHQ / Ledger1 / Internal)
            // These teams get the platform for free with Enterprise access.
            if (sub.team?.slug === "basalthq" || sub.team?.slug === "ledger1" || sub.team?.slug === "internal") {
                console.log(`🛡️ [Collector] Skipping Platform Team: ${sub.team?.name}`);
                await (prismadb as any).crm_Subscriptions.update({
                    where: { id: sub.id },
                    data: {
                        last_charge_date: new Date(),
                        last_charge_status: "SYSTEM_FREE_CREDIT",
                        next_billing_date: addMonths(sub.next_billing_date, 1),
                        status: "ACTIVE"
                    }
                });
                continue;
            }

            const merchantWallet = sub.team?.integrations?.surge_merchant_id;
            if (!merchantWallet) {
                console.error(`❌ [Collector] Skipping Sub ${sub.id}: Merchant has no Surge Wallet.`);
                continue;
            }

            let result: SurgeChargeResponse = { success: false, status: "failed", error: "No payment method" };

            // HYBRID FALLBACK LOGIC
            // A. Check for Crypto First if they have a wallet
            if (sub.customer_wallet) {
                console.log(`💎 [Collector] Checking Crypto Balance for ${sub.customer_wallet}...`);
                const balance = await getWalletBalance(sub.customer_wallet, "USDC", "base");

                if (balance >= sub.amount) {
                    console.log(`🌊 [Collector] "Raining" crypto from wallet for ${sub.customer_email}`);
                    result = await chargeFromWallet({
                        from_address: sub.customer_wallet,
                        amount: sub.amount,
                        token: "USDC",
                        network: "base",
                        recipient: merchantWallet,
                        description: `Crypto Payout: ${sub.plan_name}`
                    });
                } else {
                    console.log(`💳 [Collector] Insufficient Crypto ($${balance}). Falling back to Vaulted Card...`);
                }
            }

            // B. Fallback to Vaulted Card
            if (!result.success && sub.surge_vault_token) {
                result = await chargeVaultedCard({
                    vault_token: sub.surge_vault_token,
                    amount: sub.amount,
                    token: "USDC",
                    network: "base",
                    recipient: merchantWallet,
                    description: `Card Charge: ${sub.plan_name}`
                });
            }

            if (result.success) {
                console.log(`✅ [Collector] Successfully charged ${sub.amount} for ${sub.customer_email}`);

                await (prismadb as any).crm_Subscriptions.update({
                    where: { id: sub.id },
                    data: {
                        last_charge_date: new Date(),
                        last_charge_status: "SUCCESS",
                        last_transaction_id: result.transaction_id,
                        next_billing_date: addMonths(sub.next_billing_date, 1),
                        status: "ACTIVE"
                    }
                });

                // Ensure team is active
                await prismadb.team.update({
                    where: { id: sub.tenant_id },
                    data: { status: "ACTIVE" }
                });

            } else {
                console.error(`⚠️ [Collector] Charge FAILED for ${sub.customer_email}: ${result.error}`);

                await (prismadb as any).crm_Subscriptions.update({
                    where: { id: sub.id },
                    data: {
                        last_charge_status: `FAILED: ${result.error}`,
                        status: "OVERDUE"
                    }
                });
            }

        } catch (err: any) {
            console.error(`❌ [Collector] Critical error processing sub ${sub.id}:`, err.message);
        }
    }

    // 2. Shut down teams that are OVERDUE for more than 3 days
    console.log("🛡️ [Collector] Checking for stale overdue accounts (> 3 days)...");
    const staleSubscriptions = await (prismadb as any).crm_Subscriptions.findMany({
        where: {
            status: "OVERDUE",
            next_billing_date: { lt: threeDaysAgo }
        }
    });

    for (const sub of staleSubscriptions) {
        console.log(`🚫 [Collector] Suspending team ${sub.tenant_id} due to non-payment.`);

        await prismadb.team.update({
            where: { id: sub.tenant_id },
            data: {
                status: "SUSPENDED",
                suspension_reason: "Billing overdue for more than 3 days."
            }
        });

        await (prismadb as any).crm_Subscriptions.update({
            where: { id: sub.id },
            data: { status: "SUSPENDED" }
        });
    }

    console.log("🏁 [Collector] Billing run finished.");
}

runCollector()
    .catch(console.error)
    .finally(() => process.exit(0));
