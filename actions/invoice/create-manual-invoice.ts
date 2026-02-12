
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createManualInvoice(data: FormData) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return { error: "Unauthorized" };

        const teamInfo = await getCurrentUserTeamId();
        const teamId = teamInfo?.teamId;

        const amount = parseFloat(data.get("amount") as string);
        const number = data.get("number") as string;
        const description = data.get("description") as string;

        if (!amount || !number) {
            return { error: "Missing required fields" };
        }

        const newInvoice = await prismadb.invoices.create({
            data: {
                invoice_amount: amount.toString(),
                invoice_number: number,
                description: description || "Manual Invoice",
                date_created: new Date(), // Schema: date_created
                date_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Schema: date_due
                invoice_currency: "USD", // Schema: invoice_currency
                status: "Pending",
                payment_status: "UNPAID",

                // Required fields
                invoice_file_mimeType: "application/manual",
                invoice_file_url: "",

                assigned_user_id: session.user.id, // Schema: assigned_user_id

                // Assign to team
                team_id: teamId || undefined,
            }
        });

        revalidatePath("/invoice");
        return { success: true, invoiceId: newInvoice.id };

    } catch (error) {
        console.error("Create Invoice Error:", error);
        return { error: "Failed to create invoice" };
    }
}
