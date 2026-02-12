
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { createSurgeCheckoutSession } from "@/lib/surge";
import { revalidatePath } from "next/cache";

export async function generateSurgeLink(invoiceId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            throw new Error("Unauthorized");
        }

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice) {
            throw new Error("Invoice not found");
        }

        // Ensure we have a tenant/team ID to fetch config
        // Assuming invoice.assigned_team_id or similar marks the tenant context
        // Or if user is associated with a team.
        // For now, let's try to infer from invoice's relations if possible, or use user's team if simple.
        // However, invoice.team_id field exists in schema.

        const tenantId = invoice.team_id;

        if (!tenantId) {
            throw new Error("Invoice is not associated with a team/tenant");
        }

        const checkout = await createSurgeCheckoutSession(tenantId, invoice);

        if (!checkout) {
            throw new Error("Failed to create Surge session");
        }

        // Update Invoice
        await prismadb.invoices.update({
            where: { id: invoiceId },
            data: {
                surge_payment_id: checkout.id,
                surge_payment_link: checkout.url,
                payment_status: "PENDING" // Mark as pending payment
            }
        });

        revalidatePath(`/invoice/detail/${invoiceId}`);
        return { success: true, url: checkout.url };

    } catch (error) {
        console.error("[GenerateSurgeLink]", error);
        return { success: false, error: "Failed to generate link" };
    }
}
