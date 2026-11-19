import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    const targetUrl = searchParams.get("url");

    if (!token || !targetUrl) {
        return new NextResponse("Bad Request: Missing token or target URL", { status: 400 });
    }

    let parsedTarget: URL;
    try {
        parsedTarget = new URL(targetUrl);
    } catch {
        return new NextResponse("Bad Request: Invalid target URL", { status: 400 });
    }

    if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
        return new NextResponse("Bad Request: Disallowed URL protocol", { status: 400 });
    }

    try {
        // Verify token matches an existing outreach item before redirecting
        const outreachItem = await prismadb.crm_Outreach_Items.findFirst({
            where: { tracking_token: token }
        });

        if (!outreachItem) {
            return new NextResponse("Bad Request: Invalid tracking token", { status: 400 });
        }

        try {
            const now = new Date();
            await prismadb.crm_Outreach_Items.update({
                where: { id: outreachItem.id },
                data: {
                    clickedAt: now,
                    status: "CLICKED"
                }
            });

            // Update campaign stats
            await prismadb.crm_Outreach_Campaigns.update({
                where: { id: outreachItem.campaign },
                data: {
                    emails_opened: { increment: 1 } // If click happened, it's definitely opened too
                }
            });

            // Update Lead Status
            if (outreachItem.lead) {
                await (prismadb as any).crm_Leads.update({
                    where: { id: outreachItem.lead },
                    data: {
                        outreach_status: "MEETING_LINK_CLICKED",
                        status: "ACTIVE"
                    }
                });

                // Log Activity specifically for FLOW STATE tracking
                await (prismadb as any).crm_Lead_Activities.create({
                    data: {
                        lead: outreachItem.lead,
                        type: "EMAIL_CLICK",
                        title: "Link Clicked (FLOW STATE Pixel)",
                        description: `The recipient clicked a link in the outreach email for campaign ${outreachItem.campaign}. Target: ${parsedTarget.toString()}`,
                        createdAt: now,
                        v: 1
                    }
                });

                // Update parent account if linked
                const lead = await (prismadb as any).crm_Leads.findUnique({
                    where: { id: outreachItem.lead },
                    select: { accountsIDs: true }
                });

                if (lead?.accountsIDs) {
                    await (prismadb as any).crm_Accounts.update({
                        where: { id: lead.accountsIDs },
                        data: { status: "Active" }
                    });
                }
            }
        } catch (statsError) {
            systemLogger.warn("[EMAIL_TRACK_CLICK_STATS_ERROR]", statsError);
        }

        return NextResponse.redirect(parsedTarget.toString());
    } catch (error) {
        systemLogger.error("[EMAIL_TRACK_CLICK_ERROR]", error);
        return new NextResponse("Bad Request", { status: 400 });
    }
}
