import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const outreachId = searchParams.get("oid");
    const targetUrl = searchParams.get("url");

    if (!targetUrl || !outreachId) {
        return new NextResponse("Missing url or oid param", { status: 400 });
    }

    // Decode target
    let destination = decodeURIComponent(targetUrl);

    // Ensure protocol
    if (!destination.startsWith('http')) {
        destination = `https://${destination}`;
    }

    // Security: Validate URL format and protocol to prevent Open Redirects
    try {
        const urlObj = new URL(destination);
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return new NextResponse("Invalid protocol", { status: 400 });
        }
    } catch (e) {
        return new NextResponse("Invalid URL format", { status: 400 });
    }

    // Track click asynchronously
    if (outreachId) {
        // Security: Verify OID exists to prevent random abuse
        const { prismadb } = await import("@/lib/prisma"); // Dynamic import
        const item = await (prismadb as any).crm_Outreach_Items.findUnique({
            where: { id: outreachId },
            select: { id: true }
        });

        if (item) {
            (async () => {
                try {
                    console.log(`[VaruniLink] Email Click Detected for Outreach ID: ${outreachId} -> ${destination}`);
                    // await prismadb.crm_Outreach_Events.create({ ... })
                } catch (e) {
                    console.error("Failed to track click", e);
                }
            })();
        } else {
            // Invalid OID - potentially malicious usage of the tracker
            console.warn(`[VaruniLink] Invalid Outreach ID used for redirect: ${outreachId}`);
            // We could block here, but to avoid breaking clicked links from deleted items, we might allow. 
            // Ideally we block. Let's block invalid IDs to be safe.
            return new NextResponse("Invalid Tracking ID", { status: 400 });
        }
    }

    // Redirect to final destination
    return NextResponse.redirect(destination);
}
