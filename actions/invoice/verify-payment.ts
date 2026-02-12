
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSurgePaymentStatus } from "@/lib/surge";

export async function verifySurgePayment(invoiceId: string) {
    try {
        const session = await getServerSession(authOptions);
        // Auth check

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice || !invoice.surge_payment_id) {
            return { error: "Invoice not found or no payment ID" };
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
