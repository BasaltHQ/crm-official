import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const targetUrl = searchParams.get('url');
    const outreachId = searchParams.get('oid');

    if (!targetUrl) {
        return new NextResponse("Invalid URL", { status: 400 });
    }

    // Decode target
    let destination = decodeURIComponent(targetUrl);
    if (!destination.startsWith('http')) {
        destination = `https://${destination}`;
    }

    // Track click asynchronously
    if (outreachId) {
        (async () => {
            try {
                console.log(`[VaruniLink] Email Click Detected for Outreach ID: ${outreachId} -> ${destination}`);
                // await prismadb.crm_Outreach_Events.create({ ... })
            } catch (e) {
                console.error("Failed to track click", e);
            }
        })();
    }

    // Redirect to final destination
    return NextResponse.redirect(destination);
}
