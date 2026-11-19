
"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";

export async function updateInvoice(invoiceId: string, data: FormData) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) return { error: "Unauthorized" };

        const existing = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
            select: { id: true, team_id: true },
        });
        if (!existing) return { error: "Invoice not found" };

        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            return { error: "Forbidden" };
        }

        const partner = data.get("partner") as string;
        const payment_status = data.get("payment_status") as string;
        const amount = data.get("amount") as string;

        await prismadb.invoices.update({
            where: { id: invoiceId },
            data: {
                partner: partner,
                payment_status: payment_status,
                invoice_amount: amount,
                // Add more fields as needed
            }
        });

        revalidatePath("/invoice");
        return { success: true };

    } catch (error) {
        console.error("Update Invoice Error:", error);
        return { error: "Failed to update invoice" };
    }
}
