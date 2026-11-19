
"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { getSurgePaymentStatus } from "@/lib/surge";

export async function verifySurgePayment(invoiceId: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            return { error: "Unauthorized" };
        }

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice || !invoice.surge_payment_id) {
            return { error: "Invoice not found or no payment ID" };
        }

        if (!validateResourceOwnership(teamInfo.teamId, invoice.team_id, teamInfo.isPlatformAdmin)) {
            return { error: "Forbidden" };
        }

        const tenantId = invoice.team_id;
        if (!tenantId) {
            console.error("Invoice has no associated tenant/team", invoice.id);
            return { error: "Invoice has no associated tenant/team" };
        }

        const statusData = await getSurgePaymentStatus(tenantId, invoice.surge_payment_id);

        if (!statusData) {
            return { error: "Failed to fetch payment status from Surge" };
        }

        if (statusData.paid) {
            await prismadb.invoices.update({
                where: { id: invoiceId },
                data: {
                    payment_status: "PAID",
                    status: "Paid"
                }
            });
            revalidatePath(`/invoice/detail/${invoiceId}`);
            revalidatePath(`/invoice`);
            return { success: true, status: "Paid" };
        } else {
            return { success: false, status: statusData.status, message: "Payment not completed yet" };
        }

    } catch (error) {
        console.error("Verify Payment Error:", error);
        return { error: "Verification failed" };
    }
}
