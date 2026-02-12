
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateInvoice(invoiceId: string, data: FormData) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return { error: "Unauthorized" };

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
