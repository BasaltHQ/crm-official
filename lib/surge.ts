
import axios from 'axios';
import { prismadb } from '@/lib/prisma';
import https from 'https';

const SURGE_API_BASE = 'https://surge.basalthq.com/api';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

interface SurgeOrderResponse {
    receiptId: string;
    orderId: string;
    // other fields
}

/**
 * Creates a checkout session with BasaltSurge (Internal)
 * Flow: 
 * 1. Create/Update Inventory Item for this Invoice (to set price)
 * 2. Generate Order
 * 3. Return Payment URL
 */
export async function createSurgeCheckoutSession(tenantId: string, invoice: any): Promise<{ id: string, url: string } | null> {
    try {
        // 1. Fetch Tenant Secrets
        // Note: Using findFirst to be safe if multiple integrations exist, prioritized by existence of key
        const integration = await prismadb.tenant_Integrations.findFirst({
            where: { tenant_id: tenantId }
        });

        if (!integration || !integration.surge_enabled || !integration.surge_api_key) {
            console.warn(`[BasaltSurge] Integration not enabled or missing keys for tenant ${tenantId}`);
            return null;
        }

        const apiKey = integration.surge_api_key;
        const sku = `INV-${invoice.invoice_number || invoice.id}`;
        const amount = parseFloat(invoice.invoice_amount || "0");

        // 2. Create/Ensure Inventory Item exists
        // We do this to ensure the price is correct for this specific invoice
        try {
            await axios.post(
                `${SURGE_API_BASE}/inventory`,
                {
                    sku: sku,
                    name: `Invoice #${invoice.invoice_number}`,
                    priceUsd: amount, // Assuming base currency is USD for this API
                    stockQty: 9999, // Infinite stock
                    taxable: false, // Invoices usually tax-inclusive or handled separately
                    description: invoice.description || "Invoice Payment"
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Ocp-Apim-Subscription-Key': apiKey
                    },
                    httpsAgent: httpsAgent
                }
            );
        } catch (invError: any) {
            // If item exists, we might need to update it? 
            // Or ignore if it's 409 (Conflict).
            if (invError.response?.status !== 409) {
                console.warn("[BasaltSurge] Inventory creation warning:", invError.message);
            }
        }

        // 3. Generate Order
        const orderPayload = {
            items: [
                {
                    sku: sku,
                    qty: 1
                }
            ],
            jurisdictionCode: "US-CA", // Defaulting, maybe should be config in Tenant_Integrations
            metadata: {
                invoiceId: invoice.id,
                tenantId: tenantId
            }
        };

        const response = await axios.post<SurgeOrderResponse>(
            `${SURGE_API_BASE}/orders`,
            orderPayload,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': apiKey
                },
                httpsAgent: httpsAgent
            }
        );

        // API Response might be { receipt: { receiptId: ... } } or just { receiptId: ... }
        const data = response.data as any;
        console.log("[BasaltSurge] Full Order Response:", JSON.stringify(data, null, 2));

        const receiptId = data.receipt?.receiptId || data.receiptId;

        if (!receiptId) {
            console.error("[BasaltSurge] No receiptId in response:", data);
            throw new Error("No receiptId returned from Surge");
        }

        console.log(`[BasaltSurge] Generated Receipt ID: ${receiptId}`);

        const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invoice/detail/${invoice.id}?payment=success`;
        console.log(`[BasaltSurge] Using Return URL: ${returnUrl}`);

        // Construct Payment URL based on Doc Review
        // 1. Use /portal/ for the enhanced UI
        // 2. recipient MUST be a 0x address for successful settlement
        // 3. layout=invoice optimizes for the user's specific use case
        const params = new URLSearchParams({
            returnUrl: returnUrl,
            layout: 'invoice',
            invoice: '1',
            preferredChain: integration.preferred_chain || 'BASE'
        });

        if (integration.surge_merchant_id && integration.surge_merchant_id.startsWith('0x')) {
            params.append('recipient', integration.surge_merchant_id);
        } else if (integration.surge_merchant_id) {
            // If it's a key_ or ID, it might be used at the order creation level, 
            // but for the portal URL, we try to pass it as merchantId if not 0x.
            params.append('merchantId', integration.surge_merchant_id);
        }

        const paymentUrl = `https://surge.basalthq.com/portal/${receiptId}?${params.toString()}`;

        console.log(`[BasaltSurge] Final Link: ${paymentUrl}`);

        return {
            id: receiptId,
            url: paymentUrl
        };

    } catch (error: any) {
        console.error("[BasaltSurge] Error creating checkout session:", error.response?.data || error.message);
        return null;
    }
}

export async function getSurgePaymentStatus(tenantId: string, receiptId: string): Promise<{ status: string, paid: boolean } | null> {
    try {
        // Fetch Tenant Secrets
        const integration = await prismadb.tenant_Integrations.findFirst({
            where: { tenant_id: tenantId }
        });

        if (!integration || !integration.surge_enabled || !integration.surge_api_key) {
            console.warn(`[BasaltSurge] Integration not enabled or missing keys for tenant ${tenantId}`);
            return null;
        }

        const apiKey = integration.surge_api_key;

        // Try to get receipt status
        const response = await axios.get(
            `${SURGE_API_BASE}/receipts/${receiptId}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': apiKey
                },
                httpsAgent: httpsAgent
            }
        );

        if (response.data) {
            // Support both root-level status and nested receipt-level status if present
            const status = response.data.receipt?.status || response.data.status || 'unknown';
            console.log(`[BasaltSurge] Receipt ${receiptId} status: ${status}`);

            // Possible successful statuses: 'checkout_success' (Portal), 'confirmed' (Chain), 'complete'/'completed' (Final)
            const paid = [
                'confirmed',
                'complete',
                'completed',
                'paid',
                'checkout_success'
            ].includes(status.toLowerCase());

            return { status, paid };
        }

        return null;

    } catch (error: any) {
        console.error("[BasaltSurge] Error getting payment status:", error.message);
        return null;
    }
}
