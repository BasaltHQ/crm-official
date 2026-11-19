"use server";

import { prismadb } from "@/lib/prisma";
import { createSurgeCheckoutSession } from "@/lib/surge";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { requirePlatformAdmin } from "@/lib/security/authz";

export async function generateSurgeLink(invoiceId: string) {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.userId || !teamInfo?.teamId) {
            return { success: false, error: "Unauthorized" };
        }

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId }
        });

        if (!invoice) {
            return { success: false, error: "Invoice not found" };
        }

        const tenantId = invoice.team_id;
        if (!tenantId) {
            return { success: false, error: "Invoice is not associated with a team/tenant" };
        }

        // Enforce strict tenant ownership unless Platform Admin
        if (tenantId !== teamInfo.teamId && !teamInfo.isPlatformAdmin) {
            const admin = await requirePlatformAdmin();
            if (!admin) {
                return { success: false, error: "Forbidden: Invoice does not belong to your team" };
            }
        }

        const checkout = await createSurgeCheckoutSession(tenantId, invoice);

        if (!checkout) {
            throw new Error("Failed to create Surge session");
        }

        // 3. Sync with Mercury (No-Exit Handshake)
        let mercuryInvoiceId = invoice.mercury_invoice_id;
        try {
            const { createMercuryReceivable } = await import("@/lib/mercury");
            const mercuryInvoice = await createMercuryReceivable(tenantId, {
                ...invoice,
                surge_payment_id: checkout.id,
                surge_payment_link: checkout.url
            });
            if (mercuryInvoice?.id) {
                mercuryInvoiceId = mercuryInvoice.id;
                systemLogger.error(`[GenerateSurgeLink] Linked Mercury Invoice: ${mercuryInvoiceId}`);
            }
        } catch (mercuryError) {
            systemLogger.error("[GenerateSurgeLink] Mercury handshake failed or skipped:", mercuryError);
        }

        // 4. Update Invoice
        await prismadb.invoices.update({
            where: { id: invoiceId },
            data: {
                surge_payment_id: checkout.id,
                surge_payment_link: checkout.url,
                mercury_invoice_id: mercuryInvoiceId,
                payment_status: "PENDING" // Mark as pending payment
            }
        });

        revalidatePath(`/invoice/detail/${invoiceId}`);
        return { success: true, url: checkout.url };

    } catch (error) {
        systemLogger.error("[GenerateSurgeLink]", error);
        return { success: false, error: "Failed to generate link" };
    }
}
