
import axios from 'axios';
import { prismadb } from '@/lib/prisma';

const MERCURY_API_BASE = 'https://api.mercury.com/api/v1'; // Placeholder

interface MercuryInvoiceResponse {
    id: string;
    note: string;
    amount: number;
    status: string;
}

/**
 * Creates a receivable invoice in Mercury to mirror the CRM invoice.
 */
export async function createMercuryReceivable(tenantId: string, invoice: any) {
    try {
        // 1. Fetch Tenant Secrets
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: tenantId }
        });

        if (!integration || !integration.mercury_enabled || !integration.mercury_api_key) {
            console.warn(`[Mercury] Integration not enabled or missing keys for tenant ${tenantId}`);
            return null;
        }

        // 2. Construct Payload
        // Mercury's API for creating an invoice/receivable
        const payload = {
            kind: "receivable",
            amount: parseFloat(invoice.invoice_amount || "0"),
            currency: invoice.invoice_currency || "USD",
            note: `Invoice #${invoice.invoice_number} - ${invoice.description || ""}`,
            external_id: invoice.id,
            due_at: invoice.date_due ? new Date(invoice.date_due).toISOString() : undefined,
            email: invoice.partner_email, // If we want to send it via Mercury (optional)
        };

        // 3. Call Mercury API
        const response = await axios.post<MercuryInvoiceResponse>(
            `${MERCURY_API_BASE}/invoices`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${integration.mercury_api_key}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        return response.data;

    } catch (error) {
        console.error("[Mercury] Error creating receivable:", error);
        return null;
    }
}

export async function markMercuryInvoicePaid(tenantId: string, mercuryId: string) {
    // Implementation placeholder... since Mercury API differs, usually we just reconcile transactions.
    // Assuming there is an endpoint to update status:
    try {
        const integration = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: tenantId }
        });

        if (!integration || !integration.mercury_api_key) return;

        await axios.put(
            `${MERCURY_API_BASE}/invoices/${mercuryId}`,
            { status: "paid" },
            {
                headers: { 'Authorization': `Bearer ${integration.mercury_api_key}` }
            }
        );
        console.log(`[Mercury] Marked invoice ${mercuryId} as paid`);
    } catch (e) {
        console.error("[Mercury] Failed to mark as paid", e);
    }
}
