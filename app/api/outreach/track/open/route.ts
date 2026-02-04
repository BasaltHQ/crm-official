import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const outreachId = searchParams.get('oid');

    // Always return the 1x1 transparent GIF immediately
    const pixel = Buffer.from(
        "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        "base64"
    );

    const response = new NextResponse(pixel, {
        headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    });

    // Track asynchronously
    if (outreachId) {
        (async () => {
            try {
                // Log the view
                // requires a model like `crm_Outreach_Events` or similar
                // For now, logging to console or updating a counter if model exists
                console.log(`[VaruniLink] Email Open Detected for Outreach ID: ${outreachId}`);

                // Assuming we might have a crm_Outreach or similar table
                // await prismadb.crm_Campaign_Leads.update(...)
            } catch (error) {
                console.error("Failed to track email open", error);
            }
        })();
    }

    return response;
}
