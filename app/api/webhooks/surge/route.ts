
import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

// This should be in env
const SURGE_WEBHOOK_SECRET = process.env.SURGE_WEBHOOK_SECRET;

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // TODO: Verify Signature
        // Surge usually sends a header 'X-Surge-Signature'
        // const signature = req.headers.get('X-Surge-Signature');
        // if (!verifySignature(JSON.stringify(body), signature, SURGE_WEBHOOK_SECRET)) {
        //     return new NextResponse("Invalid Signature", { status: 401 });
        // }

        const { type, data } = body;

        if (type === "payment.confirmed" || type === "payment.succeeded") {
            const externalId = data.external_id; // This should be our Invoice ID or custom reference
            const paymentId = data.id;

            console.log(`[Surge Webhook] Payment confirmed for invoice: ${externalId}`);

            if (!externalId) {
                return new NextResponse("Missing external_id", { status: 400 });
            }

            // 1. Update Invoice
            const invoice = await prismadb.invoices.update({
                where: { id: externalId },
                data: {
                    payment_status: "PAID",
                    status: "PAID", // Legacy status field
                    last_updated: new Date()
                },
                include: {
                    opportunities: true // To find linked deal
                }
            });

            // 1.1 Sync with Mercury
            if (invoice.mercury_invoice_id && invoice.team_id) {
                // Import dynamically or at top. Using dynamic import to avoid circular dep if any?
                // Better import at top. But for this tool I can't add import at top easily without context.
                // I will assume markMercuryInvoicePaid is imported. 
                // Wait, I can't just assume. I need to add the import.
                // I'll update the whole file to be safe or use require? No, ESM.

                // I'll use a subsequent step to add import. Here just the call.
                try {
                    const { markMercuryInvoicePaid } = await import("@/lib/mercury");
                    await markMercuryInvoicePaid(invoice.team_id, invoice.mercury_invoice_id);
                } catch (e) {
                    console.error("[Surge Webhook] Mercury sync failed", e);
                }
            }

            // 2. Update Linked Deal / Opportunity to WON
            // 2. Update Linked Deal / Opportunity to WON
            if (invoice.opportunities && invoice.opportunities.length > 0) {
                const dealId = invoice.opportunities[0].id;

                // Find the "Closed Won" stage - handle variations
                const wonStage = await prismadb.crm_Opportunities_Sales_Stages.findFirst({
                    where: {
                        name: { in: ["Closed Won", "Won", "Closed", "Deal Won"] }
                    }
                });

                await prismadb.crm_Opportunities.update({
                    where: { id: dealId },
                    data: {
                        status: "CLOSED",
                        sales_stage: wonStage ? wonStage.id : undefined,
                        close_date: new Date()
                    }
                });
                console.log(`[Surge Webhook] Updated Deal ${dealId} to CLOSED/WON`);
            }
        }

        return new NextResponse("OK", { status: 200 });

    } catch (error) {
        console.error("[Surge Webhook] Error", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
