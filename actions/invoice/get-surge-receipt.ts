
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import axios from 'axios';
import https from 'https';

const SURGE_API_BASE = 'https://surge.basalthq.com/api';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

export async function getSurgeReceipt(invoiceId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return null;

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice || !invoice.surge_payment_id) {
            return null;
        }

        const integration = await prismadb.tenant_Integrations.findFirst({
            where: { tenant_id: invoice.team_id as string }
        });

        if (!integration || !integration.surge_api_key) {
            return null;
        }

        const response = await axios.get(
            `${SURGE_API_BASE}/receipts/${invoice.surge_payment_id}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': integration.surge_api_key
                },
                httpsAgent: httpsAgent
            }
        );

        return response.data;
    } catch (error: any) {
        console.error("[getSurgeReceipt] Error:", error.message);
        return null;
    }
}
