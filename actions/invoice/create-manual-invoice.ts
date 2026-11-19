
"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";

export async function createManualInvoice(data: FormData) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session || !teamInfo) return { error: "Unauthorized" };

        const teamId = teamInfo.teamId;

        const amount = parseFloat(data.get("amount") as string);
        const number = data.get("number") as string;
        const description = data.get("description") as string;
        const opportunityId = data.get("opportunityId") as string;

        if (!amount || !number) {
            return { error: "Missing required fields" };
        }

        // Fetch opportunity details if provided and verify tenant ownership
        let accountId: string | undefined;
        if (opportunityId && opportunityId !== "none") {
            const opp = await prismadb.crm_Opportunities.findUnique({
                where: { id: opportunityId },
                select: { account: true, lead_id: true, team_id: true }
            });
            if (!opp || !validateResourceOwnership(teamId, opp.team_id, teamInfo.isPlatformAdmin)) {
                return { error: "Forbidden — invalid opportunity" };
            }
            if (opp.account) accountId = opp.account;
        }

        const newInvoice = await prismadb.invoices.create({
            data: {
                invoice_amount: amount.toString(),
                invoice_number: number,
                description: description || "Manual Invoice",
                date_created: new Date(),
                date_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                invoice_currency: "USD",
                status: "Pending",
                payment_status: "UNPAID",

                // Required fields
                invoice_file_mimeType: "application/manual",
                invoice_file_url: "",

                assigned_user_id: session.user.id,
                assigned_account_id: accountId,

                // Assign to team
                team_id: teamId || undefined,

                // Opportunity link - This triggers deduplication in health/revenue charts
                ...(opportunityId && opportunityId !== "none" ? {
                    opportunities: {
                        connect: { id: opportunityId }
                    }
                } : {})
            }
        });

        revalidatePath("/invoice");
        return { success: true, invoiceId: newInvoice.id };

    } catch (error) {
        console.error("Create Invoice Error:", error);
        return { error: "Failed to create invoice" };
    }
}
