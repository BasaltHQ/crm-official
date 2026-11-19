
"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { sendSmsEum } from "@/lib/aws/eum-sms";
import { systemLogger } from "@/lib/logger";

export async function sendInvoiceSMS(invoiceId: string, phone: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) return { error: "Unauthorized" };

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice) return { error: "Invoice not found" };

        if (!validateResourceOwnership(teamInfo.teamId, invoice.team_id, teamInfo.isPlatformAdmin)) {
            return { error: "Forbidden" };
        }

        const paymentLink = invoice.surge_payment_link;
        if (!paymentLink) return { error: "No payment link generated. Enable Crypto Payments first." };

        // Send SMS via AWS EUM
        try {
            const message = `Payment Link for Invoice #${invoice.invoice_number}: ${paymentLink}`;
            await sendSmsEum({ to: phone, body: message });

            systemLogger.error(`[SendInvoiceSMS] SMS sent to ${phone}`);
            return { success: true, message: "SMS sent" };
        } catch (smsError: any) {
            systemLogger.error("[SendInvoiceSMS] EUM Error:", smsError.message);
            return { error: "Failed to send SMS: " + smsError.message };
        }

    } catch (error) {
        console.error("Send Invoice SMS Error:", error);
        return { error: "Failed to send invoice via SMS" };
    }
}
