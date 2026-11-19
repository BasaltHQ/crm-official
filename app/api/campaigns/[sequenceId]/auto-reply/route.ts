import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { sequenceId } = await params;
        const body = await req.json();
        const { enabled, max_count, prompt, backfill_only } = body;

        // Verify campaign exists and belongs to caller's team
        const campaign = await prismadb.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
            select: { id: true, user: true, team_id: true, auto_reply_enabled: true },
        });

        if (!campaign) {
            return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, campaign.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && campaign.user !== session!.user.id) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        // If backfill_only, skip toggle — just run the scan
        const shouldBackfill = backfill_only
            ? !!campaign.auto_reply_enabled
            : (enabled && !campaign.auto_reply_enabled);

        if (!backfill_only) {
            // Update auto-reply settings
            const updateData: any = {};
            if (typeof enabled === "boolean") updateData.auto_reply_enabled = enabled;
            if (typeof max_count === "number") updateData.auto_reply_max_count = max_count;
            if (typeof prompt === "string") updateData.auto_reply_prompt = prompt || null;

            if (Object.keys(updateData).length > 0) {
                await prismadb.crm_Outreach_Campaigns.update({
                    where: { id: sequenceId },
                    data: updateData,
                });
            }
        }

        let backfillCount = 0;

        // Scan for existing unanswered inbound threads and trigger auto-replies
        if (shouldBackfill) {
            try {
                // Find outreach items that have been replied to but never auto-replied
                // Use NOT > 0 to catch both null and 0 values
                const repliedItems = await prismadb.crm_Outreach_Items.findMany({
                    where: {
                        campaign: sequenceId,
                        status: "REPLIED" as any,
                        NOT: {
                            auto_reply_count: { gt: 0 },
                        },
                    },
                    select: { id: true },
                });

                systemLogger.info(`[AUTO_REPLY_BACKFILL] Found ${repliedItems.length} unreplied items for campaign ${sequenceId}`);

                if (repliedItems.length > 0) {
                    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://crm.basalthq.com";

                    // For each unreplied item, find the latest inbound thread and trigger auto-reply
                    for (const item of repliedItems) {
                        const latestInbound = await prismadb.crm_Email_Thread.findFirst({
                            where: {
                                outreach_item: item.id,
                                direction: "INBOUND",
                            },
                            orderBy: { createdAt: "desc" },
                            select: { id: true },
                        });

                        if (latestInbound) {
                            const internalSecret =
                                process.env.SYNTHESIS_SECRET ||
                                process.env.CRON_SECRET ||
                                process.env.JWT_SECRET ||
                                "";
                            // Fire auto-reply (fire-and-forget)
                            fetch(`${appUrl}/api/outreach/reply`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "x-internal-secret": internalSecret,
                                },
                                body: JSON.stringify({
                                    outreachItemId: item.id,
                                    inboundThreadId: latestInbound.id,
                                    campaignId: sequenceId,
                                }),
                            }).catch((err) => {
                                systemLogger.error(`[AUTO_REPLY_BACKFILL] Failed for item ${item.id}:`, err);
                            });

                            backfillCount++;
                        }
                    }
                }
            } catch (backfillErr: any) {
                systemLogger.error(`[AUTO_REPLY_BACKFILL] Scan failed for campaign ${sequenceId}:`, backfillErr);
                // Don't fail the whole request — the toggle itself succeeded
            }
        }

        return NextResponse.json({
            status: "ok",
            auto_reply_enabled: enabled ?? campaign.auto_reply_enabled,
            backfill_triggered: backfillCount,
        });
    } catch (error: any) {
        systemLogger.error("[CAMPAIGN_AUTO_REPLY_TOGGLE]", error);
        return NextResponse.json(
            { message: error.message || "Failed to update auto-reply settings" },
            { status: 500 }
        );
    }
}
