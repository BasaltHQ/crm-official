
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { sendEmailSES } from "@/lib/aws/ses";

export async function sendInvoice(invoiceId: string, email: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) return { error: "Unauthorized" };

        const invoice = await prismadb.invoices.findUnique({
            where: { id: invoiceId },
        });

        if (!invoice) return { error: "Invoice not found" };

        const paymentLink = invoice.surge_payment_link;
        if (!paymentLink) return { error: "No payment link generated. Enable Crypto Payments first." };

        // Send Email via AWS SES
        try {
            await sendEmailSES({
                to: email,
                subject: `Invoice #${invoice.invoice_number} Payment Link`,
                text: `Here is your payment link for Invoice #${invoice.invoice_number}: ${paymentLink}`,
                html: `<p>Here is your payment link for Invoice <strong>#${invoice.invoice_number}</strong>:</p>
                       <p><a href="${paymentLink}">${paymentLink}</a></p>`,
            });
            console.log(`[SendInvoice] Email sent to ${email} via SES`);
            return { success: true, message: "Email sent" };
        } catch (sesError: any) {
            console.error("[SendInvoice] SES Error:", sesError.message);
            return { error: "Failed to send email: " + sesError.message };
        }

    } catch (error) {
        console.error("Send Invoice Error:", error);
        return { error: "Failed to send invoice" };
    }
}
