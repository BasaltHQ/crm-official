import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import crypto from "crypto";
import { systemLogger } from "@/lib/logger";

function verifyWebhookSignature(payload: string, signature: string | null, secret: string): boolean {
    if (!signature || !secret) return false;
    const cleanSig = signature.trim().replace(/^sha256=/i, "");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuf = Buffer.from(cleanSig, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (Buffer.byteLength(sigBuf) !== Buffer.byteLength(expBuf)) {
        return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
}

export async function POST(req: Request) {
    try {
        const secret = process.env.SURGE_WEBHOOK_SECRET;
        if (!secret) {
            systemLogger.error("[Surge Webhook] SURGE_WEBHOOK_SECRET is not configured — failing closed.");
            return new NextResponse("Webhook secret not configured", { status: 500 });
        }

        const rawBody = await req.text();
        const signature = req.headers.get("X-Surge-Signature") || req.headers.get("x-surge-signature");
        if (!verifyWebhookSignature(rawBody, signature, secret)) {
            systemLogger.error("[Surge Webhook] Invalid signature — blocked.");
            return new NextResponse("Invalid Signature", { status: 401 });
        }

        const body = JSON.parse(rawBody);
        const { type, data } = body || {};

        if (type === "payment.confirmed" || type === "payment.succeeded") {
            const externalId = data?.external_id || data?.metadata?.invoiceId;
            const paymentId = data?.id ? String(data.id) : undefined;

            if (!externalId || typeof externalId !== "string") {
                return new NextResponse("Missing external_id", { status: 400 });
            }

            // Load existing invoice FIRST for replay protection
            const existingInvoice = await prismadb.invoices.findUnique({
                where: { id: externalId },
                include: {
                    opportunities: true,
                },
            });

            if (!existingInvoice) {
                return new NextResponse("Invoice not found", { status: 404 });
            }

            if (
                existingInvoice.payment_status === "PAID" ||
                existingInvoice.status === "PAID"
            ) {
                systemLogger.info(`[Surge Webhook] Replay ignored — invoice ${externalId} already PAID.`);
                return new NextResponse("OK", { status: 200 });
            }

            // Atomically claim the invoice transition from non-PAID -> PAID
            const claimResult = await prismadb.invoices.updateMany({
                where: {
                    id: externalId,
                    payment_status: { not: "PAID" },
                },
                data: {
                    payment_status: "PAID",
                    status: "PAID",
                    last_updated: new Date(),
                },
            });

            if (claimResult.count === 0) {
                systemLogger.info(`[Surge Webhook] Concurrent replay ignored — invoice ${externalId} already PAID.`);
                return new NextResponse("OK", { status: 200 });
            }

            // 1.1 Handle LeadGen Credits fulfillment — ONLY when a matching PENDING crm_BillingInvoice exists
            // and platform billing was not overridden by custom tenant Surge keys
            if (
                existingInvoice.team_id &&
                existingInvoice.invoice_number &&
                existingInvoice.description?.includes("LeadGen Intelligence Credits")
            ) {
                const match = existingInvoice.description.match(/Credits:\s*(\d+)/);
                const credits = match ? parseInt(match[1], 10) : 0;

                if (credits > 0 && Number.isFinite(credits)) {
                    try {
                        // Ensure custom tenant Surge merchant keys could not self-settle platform credits
                        let tenantMerchantOverride = false;
                        if (!process.env.SURGE_API_KEY) {
                            const tenantIntegration = await prismadb.tenant_Integrations.findFirst({
                                where: { tenant_id: existingInvoice.team_id },
                                select: { surge_enabled: true, surge_api_key: true, surge_merchant_id: true },
                            });
                            if (
                                tenantIntegration?.surge_enabled ||
                                tenantIntegration?.surge_api_key ||
                                tenantIntegration?.surge_merchant_id
                            ) {
                                tenantMerchantOverride = true;
                            }
                        }

                        const pendingBillingInvoice = !tenantMerchantOverride
                            ? await (prismadb as any).crm_BillingInvoice.findFirst({
                                  where: {
                                      tenant_id: existingInvoice.team_id,
                                      invoice_number: {
                                          in: [
                                              `BIL-${existingInvoice.invoice_number}`,
                                              existingInvoice.invoice_number,
                                          ],
                                      },
                                      payment_status: "PENDING",
                                      type: {
                                          in: ["CREDITS", "AI_CREDITS", "AI_USAGE", "SUBSCRIPTION"],
                                      },
                                  },
                              })
                            : null;

                        if (pendingBillingInvoice && pendingBillingInvoice.total > 0) {
                            const billingClaim = await (prismadb as any).crm_BillingInvoice.updateMany({
                                where: {
                                    id: pendingBillingInvoice.id,
                                    payment_status: "PENDING",
                                },
                                data: {
                                    payment_status: "PAID",
                                    paid_at: new Date(),
                                    ...(paymentId ? { transaction_id: paymentId } : {}),
                                },
                            });

                            if (billingClaim.count > 0) {
                                const { addLeadGenCredits } = await import("@/lib/scraper/credits");
                                await addLeadGenCredits(existingInvoice.team_id, credits);
                                systemLogger.info(
                                    `[Surge Webhook] Successfully added ${credits} credits to team ${existingInvoice.team_id}`
                                );
                            }
                        } else {
                            systemLogger.warn(
                                `[Surge Webhook] Skipped credit fulfillment for invoice ${externalId} — no matching PENDING platform billing invoice.`
                            );
                        }
                    } catch (e) {
                        systemLogger.error("[Surge Webhook] LeadGen Credit fulfillment failed", e);
                    }
                }
            }

            // Sync with Mercury
            if (existingInvoice.mercury_invoice_id && existingInvoice.team_id) {
                try {
                    const { markMercuryInvoicePaid } = await import("@/lib/mercury");
                    await markMercuryInvoicePaid(existingInvoice.team_id, existingInvoice.mercury_invoice_id);
                } catch (e) {
                    systemLogger.error("[Surge Webhook] Mercury sync failed", e);
                }
            }

            // 2. Update Linked Deal / Opportunity to WON
            if (existingInvoice.opportunities && existingInvoice.opportunities.length > 0) {
                const dealId = existingInvoice.opportunities[0].id;

                const wonStage = await prismadb.crm_Opportunities_Sales_Stages.findFirst({
                    where: {
                        name: { in: ["Closed Won", "Won", "Closed", "Deal Won"] }
                    }
                });

                await prismadb.crm_Opportunities.update({
                    where: { id: dealId },
                    data: {
                        status: "CLOSED",
                        sales_stage: wonStage ? wonStage.id : undefined,
                        close_date: new Date()
                    }
                });
                systemLogger.info(`[Surge Webhook] Updated Deal ${dealId} to CLOSED/WON`);
            }
        }

        return new NextResponse("OK", { status: 200 });

    } catch (error) {
        systemLogger.error("[Surge Webhook] Error", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
