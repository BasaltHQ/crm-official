"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";

export async function assignInvoiceToOpportunity(invoiceId: string, opportunityId: string, type: string = "crm_opportunity") {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice) throw new Error("Invoice not found");

        if (!validateResourceOwnership(teamInfo.teamId, invoice.team_id, teamInfo.isPlatformAdmin)) {
            throw new Error("Forbidden");
        }

        let amountInt = 0;
        if (invoice.invoice_amount) {
            const clean = invoice.invoice_amount.replace(/[^0-9.]/g, '');
            const floatVal = parseFloat(clean);
            if (!isNaN(floatVal)) {
                amountInt = Math.round(floatVal);
            }
        }

        if (type === "project_opportunity") {
            // Handle Project Opportunity (Feature)
            const opportunity = await prismadb.project_Opportunities.findUnique({
                where: { id: opportunityId },
                include: {
                    invoices: true,
                    assigned_project: { select: { team_id: true } },
                }
            });
            if (!opportunity) throw new Error("Project Opportunity not found");

            if (!validateResourceOwnership(teamInfo.teamId, opportunity.assigned_project?.team_id || null, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden");
            }

            // Link in Invoice
            await prismadb.invoices.update({
                where: { id: invoiceId },
                data: {
                    project_opportunities: {
                        connect: { id: opportunityId }
                    },
                },
            });

            // Calculate new total including the new invoice
            // Note: The new invoice isn't in 'opportunity.invoices' yet because we just fetched it before linking (or race condition).
            // Safer to re-fetch or add manually.
            // Let's re-fetch to be safe and clean.

            const updatedOpportunityInvoices = await prismadb.project_Opportunities.findUnique({
                where: { id: opportunityId },
                include: { invoices: true }
            });

            const totalValue = (updatedOpportunityInvoices?.invoices as any[] || []).reduce((acc, inv) => {
                const val = parseFloat(inv.invoice_amount?.replace(/[^0-9.]/g, '') || "0");
                return acc + (isNaN(val) ? 0 : val);
            }, 0) || 0;


            // Update Value
            await prismadb.project_Opportunities.update({
                where: { id: opportunityId },
                data: {
                    invoices: {
                        connect: { id: invoiceId } // Ensure connected if not already
                    },
                    valueEstimate: Math.round(totalValue),
                },
            });

        } else {
            // Handle CRM Opportunity (Default)
            const opportunity = await prismadb.crm_Opportunities.findUnique({
                where: { id: opportunityId },
            });
            if (!opportunity) throw new Error("Opportunity not found");

            if (!validateResourceOwnership(teamInfo.teamId, opportunity.team_id, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden");
            }

            // 1. Connect the invoice
            await prismadb.invoices.update({
                where: { id: invoiceId },
                data: {
                    opportunities: {
                        connect: { id: opportunityId }
                    },
                },
            });

            await prismadb.crm_Opportunities.update({
                where: { id: opportunityId },
                data: {
                    invoices: {
                        connect: { id: invoiceId }
                    }
                }
            });

            // 2. Fetch all invoices to sum them up
            const updatedOpp = await prismadb.crm_Opportunities.findUnique({
                where: { id: opportunityId },
                include: { invoices: true }
            });

            const totalRevenue = (updatedOpp?.invoices as any[] || []).reduce((acc, inv) => {
                const val = parseFloat(inv.invoice_amount?.replace(/[^0-9.]/g, '') || "0");
                return acc + (isNaN(val) ? 0 : val);
            }, 0) || 0;

            // 3. Update the budget/revenue
            await prismadb.crm_Opportunities.update({
                where: { id: opportunityId },
                data: {
                    budget: Math.round(totalRevenue),
                    expected_revenue: Math.round(totalRevenue),
                },
            });
        }

        revalidatePath("/invoice");
        revalidatePath(`/crm/opportunities/${opportunityId}`);
        revalidatePath("/", "layout"); // Update everything including dashboard

        return { success: true };
    } catch (error) {
        systemLogger.error("[ASSIGN_OPPORTUNITY]", error);
        return { error: "Failed to assign opportunity" };
    }
}
