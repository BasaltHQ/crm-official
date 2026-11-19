"use server";

import { prismadb } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import axios from 'axios';
import https from 'https';
import { systemLogger } from "@/lib/logger";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { requirePlatformAdmin } from "@/lib/security/authz";

const SURGE_API_BASE = 'https://surge.basalthq.com/api';

const allowSelfSigned =
    process.env.SURGE_ALLOW_SELF_SIGNED === "true" &&
    process.env.NODE_ENV !== "production";

const httpsAgent = new https.Agent({
    rejectUnauthorized: !allowSelfSigned,
});

export async function getSurgeReceipt(invoiceId: string) {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.userId || !teamInfo?.teamId) return null;

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice || !invoice.surge_payment_id || !invoice.team_id) {
            return null;
        }

        if (invoice.team_id !== teamInfo.teamId && !teamInfo.isPlatformAdmin) {
            const admin = await requirePlatformAdmin();
            if (!admin) return null;
        }

        if (!/^[a-zA-Z0-9_-]{1,128}$/.test(invoice.surge_payment_id)) {
            return null;
        }

        const integration = await prismadb.tenant_Integrations.findFirst({
            where: { tenant_id: invoice.team_id as string }
        });

        if (!integration || !integration.surge_api_key) {
            return null;
        }

        const apiKey = decryptSecret(integration.surge_api_key);
        if (!apiKey) {
            return null;
        }

        const response = await axios.get(
            `${SURGE_API_BASE}/receipts/${encodeURIComponent(invoice.surge_payment_id)}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Ocp-Apim-Subscription-Key': apiKey
                },
                httpsAgent: httpsAgent
            }
        );

        return response.data;
    } catch (error: any) {
        systemLogger.error("[getSurgeReceipt] Error:", error.message);
        return null;
    }
}
