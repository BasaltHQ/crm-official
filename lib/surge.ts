import axios from 'axios';
import { prismadb } from '@/lib/prisma';
import { decryptSecret } from '@/lib/encryption';
import https from 'https';
export * from './surge-x402';
export * from './surge-ucp';

const SURGE_API_BASE = 'https://surge.basalthq.com/api';

const allowSelfSigned =
    process.env.SURGE_ALLOW_SELF_SIGNED === 'true' &&
    process.env.NODE_ENV !== 'production';

const httpsAgent = new https.Agent({
    rejectUnauthorized: !allowSelfSigned,
});

interface SurgeOrderResponse {
    receiptId: string;
    orderId: string;
    // other fields
}

function safeDecryptSurgeKey(rawKey: string | null | undefined): string | null {
    if (!rawKey) return null;
    try {
        return decryptSecret(rawKey);
    } catch (err) {
        console.error('[BasaltSurge] Failed to decrypt tenant surge_api_key:', err);
        return null;
    }
}

/**
 * Creates a checkout session with BasaltSurge (Internal)
 * Flow: 
 * 1. Create/Update Inventory Item for this Invoice (to set price)
 * 2. Generate Order
 * 3. Return Payment URL
 */
export async function createSurgeCheckoutSession(
    tenantId: string,
    invoice: any,
    returnUrl?: string,
    options?: { forcePlatformKeys?: boolean }
): Promise<{ id: string, url: string } | null> {
    try {
        const isPlatformBillingInvoice =
            options?.forcePlatformKeys === true ||
            ['SUBSCRIPTION', 'AI_TOPUP', 'CREDITS', 'AI_CREDITS', 'AI_USAGE'].includes(
                String(invoice?.invoice_type || '').toUpperCase()
            ) ||
            /^(SUB-|LG-|INV-SURGE-)/.test(String(invoice?.invoice_number || '')) ||
            String(invoice?.description || '').includes('LeadGen Intelligence Credits');

        let apiKey: string | null = null;
        let merchantId: string | undefined;
        let preferredChain: string = process.env.SURGE_CHAIN || 'BASE';

        if (isPlatformBillingInvoice) {
            // Platform subscriptions & credit purchases MUST exclusively settle to platform Surge credentials
            apiKey = process.env.SURGE_API_KEY || null;
            merchantId = process.env.SURGE_MERCHANT_ID || undefined;
        } else {
            const integration = await prismadb.tenant_Integrations.findFirst({
                where: { tenant_id: tenantId }
            });

            apiKey = safeDecryptSurgeKey(integration?.surge_api_key) || process.env.SURGE_API_KEY || null;
            merchantId = integration?.surge_merchant_id || process.env.SURGE_MERCHANT_ID || undefined;
            preferredChain = integration?.preferred_chain || process.env.SURGE_CHAIN || 'BASE';
        }

        if (!apiKey) {
            console.warn(`[BasaltSurge] Integration not enabled or missing keys for tenant ${tenantId}`);
            return null;
        }
        const sku = `INV-${invoice.invoice_number || invoice.id}`;
        const amount = parseFloat(invoice.invoice_amount || "0");

        // 2. Create/Ensure Inventory Item exists
        try {
            await axios.post(
                `${SURGE_API_BASE}/inventory`,
                {
                    sku: sku,
                    name: `Invoice #${invoice.invoice_number}`,
                    priceUsd: amount,
                    stockQty: 9999,
                    taxable: false,
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
            jurisdictionCode: "US-CA",
            metadata: {
                invoiceId: invoice.id,
                tenantId: tenantId,
                platformBilling: isPlatformBillingInvoice,
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

        const data = response.data as any;
        const receiptId = data.receipt?.receiptId || data.receiptId;

        if (!receiptId || !/^[a-zA-Z0-9_-]{1,128}$/.test(String(receiptId))) {
            console.error("[BasaltSurge] Invalid or missing receiptId in response");
            throw new Error("No valid receiptId returned from Surge");
        }

        // 4. Mercury Handshake (No-Exit) — only for tenant commercial invoices
        if (!isPlatformBillingInvoice) {
            import('./mercury').then(({ createMercuryReceivable }) => {
                createMercuryReceivable(tenantId, invoice).then((res) => {
                    if (res) console.log(`[MercuryHandshake] Created receivable: ${res.id}`);
                }).catch(err => {
                    console.error("[MercuryHandshake] Failed to create receivable:", err);
                });
            });
        }

        const finalReturnUrl = returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/invoice/detail/${invoice.id}?payment=success`;

        const params = new URLSearchParams({
            returnUrl: finalReturnUrl,
            layout: 'widget',
            origin: process.env.NEXT_PUBLIC_APP_URL || '',
            preferredChain
        });

        if (merchantId && merchantId.startsWith('0x')) {
            params.append('recipient', merchantId);
        } else if (merchantId) {
            params.append('merchantId', merchantId);
        }

        const useProxy = process.env.SURGE_USE_PROXY !== 'false';
        let paymentUrl = '';

        if (useProxy) {
            paymentUrl = `/api/surge-portal/${receiptId}?${params.toString()}`;
        } else {
            params.append('embedded', '1');
            paymentUrl = `https://surge.basalthq.com/portal/${receiptId}?${params.toString()}`;
        }

        return {
            id: receiptId,
            url: paymentUrl
        };

    } catch (error: any) {
        console.error("[BasaltSurge] Error creating checkout session:", error.response?.data || error.message);
        return null;
    }
}

export async function getSurgePaymentStatus(
    tenantId: string,
    receiptId: string,
    options?: { forcePlatformKeys?: boolean }
): Promise<{ status: string, paid: boolean } | null> {
    try {
        if (!receiptId || !/^[a-zA-Z0-9_-]{1,128}$/.test(receiptId)) {
            return null;
        }

        let apiKey: string | null = null;
        if (options?.forcePlatformKeys) {
            apiKey = process.env.SURGE_API_KEY || null;
        } else {
            const integration = await prismadb.tenant_Integrations.findFirst({
                where: { tenant_id: tenantId }
            });
            apiKey = safeDecryptSurgeKey(integration?.surge_api_key) || process.env.SURGE_API_KEY || null;
        }

        if (!apiKey) {
            console.warn(`[BasaltSurge] Integration not enabled or missing keys for tenant ${tenantId}`);
            return null;
        }

        const response = await axios.get(
            `${SURGE_API_BASE}/receipts/${encodeURIComponent(receiptId)}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': apiKey
                },
                httpsAgent: httpsAgent
            }
        );

        if (response.data) {
            const status = response.data.receipt?.status || response.data.status || 'unknown';

            const paid = [
                'confirmed',
                'complete',
                'completed',
                'paid',
                'checkout_success'
            ].includes(String(status).toLowerCase());

            return { status, paid };
        }

        return null;

    } catch (error: any) {
        console.error("[BasaltSurge] Error getting payment status:", error.message);
        return null;
    }
}
