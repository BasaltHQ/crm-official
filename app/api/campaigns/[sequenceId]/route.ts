import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbCrm as prisma } from "@/lib/prisma-crm";
import { systemLogger } from "@/lib/logger";
import { checkWarmupQuota } from "@/lib/email-warmup";

/**
 * GET /api/campaigns/[sequenceId]
 * Fetches a single campaign by ID with full details
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { sequenceId } = await params;

        const campaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
            include: {
                assigned_user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                    },
                },
                assigned_pool: {
                    select: {
                        id: true,
                        name: true,
                        icpConfig: true,
                    },
                },
                assigned_project: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
                outreach_items: {
                    select: {
                        id: true,
                        status: true,
                        channel: true,
                        auto_reply_count: true,
                        lead: true,
                        account_id: true,
                    },
                },
            },
        });

        if (!campaign) {
            return NextResponse.json(
                { message: "Campaign not found" },
                { status: 404 }
            );
        }

        // ── Progress reconciliation (READ-SAFE — no destructive mutations) ────
        let items = campaign.outreach_items || [];

        // Count actual statuses from outreach items
        const sentStatuses = new Set(["SENT", "OPENED", "CLICKED", "REPLIED", "BOUNCED", "DELIVERED"]);
        const actualSent = items.filter((i: any) => sentStatuses.has(i.status)).length;
        const actualReplied = items.filter((i: any) => i.status === "REPLIED").length;

        // Reconcile campaign counters (safe — only increases counts)
        const patchData: any = {};
        if (actualSent > campaign.emails_sent) patchData.emails_sent = actualSent;
        if (actualReplied > campaign.emails_replied) patchData.emails_replied = actualReplied;

        if (Object.keys(patchData).length > 0) {
            await prisma.crm_Outreach_Campaigns.update({
                where: { id: sequenceId },
                data: patchData,
            }).catch(() => {});

            if (patchData.emails_sent) (campaign as any).emails_sent = patchData.emails_sent;
            if (patchData.emails_replied) (campaign as any).emails_replied = patchData.emails_replied;
        }

        // Mark stale PENDING items as SKIPPED — but ONLY if the campaign has been
        // idle for at least 10 minutes (prevents interfering with active sends).
        const campaignAge = campaign.updatedAt
            ? Date.now() - new Date(campaign.updatedAt).getTime()
            : Infinity;
        const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
        const campaignIsDone = campaign.status === "COMPLETED" || campaign.status === "PAUSED";
        const actualPending = items.filter((i: any) => i.status === "PENDING" || i.status === "RESEARCHING" || i.status === "READY").length;

        if (actualPending > 0 && campaignIsDone && campaignAge > STALE_THRESHOLD_MS) {
            const pendingIds = items
                .filter((i: any) => i.status === "PENDING" || i.status === "RESEARCHING" || i.status === "READY")
                .map((i: any) => i.id);
            if (pendingIds.length > 0) {
                await prisma.crm_Outreach_Items.updateMany({
                    where: { id: { in: pendingIds } },
                    data: {
                        status: "SKIPPED" as any,
                        error_message: "Skipped — campaign send completed or stopped before this item was processed.",
                    },
                }).catch(() => {});
                for (const item of items) {
                    if (pendingIds.includes((item as any).id)) {
                        (item as any).status = "SKIPPED";
                    }
                }
            }
        }

        // Server-side auto-completion is disabled. Since we no longer pre-create 
        // PENDING items for ACTIVE campaigns, the items array only contains 
        // items already successfully processed. A server has no way of knowing 
        // if the chunked send loop is actually finished or just halfway done.
        // We rely entirely on the FirstContactWizard to PATCH the completion state.

        // Resolve warmup status for campaign email sender
        let warmup = null;
        try {
            const branding = (campaign.campaign_branding || {}) as any;
            const senderMode = branding.senderMode || "company";
            
            const user = await prisma.users.findUnique({
                where: { id: session.user.id },
                select: { id: true, team_id: true, email: true }
            });
            const teamId = campaign.team_id || user?.team_id;
            
            let warmupSenderEmail = user?.email || session.user.email || "";
            if (senderMode !== "personal" && teamId) {
                const teamOutboundCheck = await prisma.teamEmailConfig.findUnique({
                    where: { team_id_purpose: { team_id: teamId, purpose: "OUTREACH" } },
                    select: { smtp_user: true },
                });
                if (teamOutboundCheck?.smtp_user) {
                    warmupSenderEmail = teamOutboundCheck.smtp_user;
                }
            }
            
            if (teamId && warmupSenderEmail) {
                const warmupCheck = await checkWarmupQuota(teamId, warmupSenderEmail);
                warmup = {
                    phase: warmupCheck.phase,
                    dailyLimit: warmupCheck.dailyLimit,
                    sentToday: warmupCheck.sentToday,
                    remaining: warmupCheck.remaining,
                    daysActive: warmupCheck.daysActive,
                    allowed: warmupCheck.allowed,
                    message: warmupCheck.message,
                    senderEmail: warmupSenderEmail,
                };
            }
        } catch (warmupErr) {
            systemLogger.error("[CAMPAIGN_GET_WARMUP_ERR]", warmupErr);
        }

        return NextResponse.json({
            ...campaign,
            warmup,
        });
    } catch (error: any) {
        systemLogger.error("[CAMPAIGN_GET_BY_ID]", error);
        return NextResponse.json(
            { message: error.message || "Failed to fetch campaign" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/campaigns/[sequenceId]
 * Updates campaign status (stop, pause, resume).
 * Body: { status: "PAUSED" | "ACTIVE" | "COMPLETED" }
 */
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { sequenceId } = await params;
        const body = await req.json();
        const { status, campaignBranding } = body;

        // At least one field must be provided
        if (!status && !campaignBranding) {
            return NextResponse.json(
                { message: "Must provide at least 'status' or 'campaignBranding'" },
                { status: 400 }
            );
        }

        const validStatuses = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json(
                { message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
                { status: 400 }
            );
        }

        const campaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
            select: { id: true, status: true, user: true, campaign_branding: true },
        });

        if (!campaign) {
            return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
        }

        const updateData: any = {};
        if (status) updateData.status = status;
        
        if (campaignBranding) {
            updateData.campaign_branding = campaignBranding;
        } else if (status === "COMPLETED" || status === "PAUSED") {
            // If stopping or completing manually, ensure repair states are cleared
            const existingBranding = (campaign.campaign_branding as any) || {};
            updateData.campaign_branding = { ...existingBranding, repair_active: false, repair_progress: null };
        }

        const updated = await prisma.crm_Outreach_Campaigns.update({
            where: { id: sequenceId },
            data: updateData,
        });

        if (status) {
            systemLogger.info(`[CAMPAIGN_STATUS] Campaign ${sequenceId} status changed: ${campaign.status} → ${status} by user ${session.user.id}`);
        }

        // If pausing, also cancel any pending CRON jobs
        if (status === "PAUSED") {
            const cronResult = await prisma.crm_Cron_Jobs.updateMany({
                where: {
                    campaign_id: sequenceId,
                    status: { not: "COMPLETED" as any },
                },
                data: { status: "PAUSED" as any },
            });
            systemLogger.info(`[CAMPAIGN_STATUS] Paused ${cronResult.count} cron jobs for campaign ${sequenceId}`);
        }

        return NextResponse.json({
            status: "ok",
            campaign_status: status,
            previous_status: campaign.status,
        });
    } catch (error: any) {
        systemLogger.error("[CAMPAIGN_STATUS_UPDATE]", error);
        return NextResponse.json(
            { message: error.message || "Failed to update campaign status" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/campaigns/[sequenceId]
 * Deletes a campaign, resets associated leads, removes outreach items, cancels CRON jobs
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ sequenceId: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { sequenceId } = await params;

        // Verify campaign exists and belongs to user
        const campaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: sequenceId },
            select: { id: true, user: true, team_id: true },
        });

        if (!campaign) {
            return NextResponse.json({ message: "Campaign not found" }, { status: 404 });
        }

        // Only the campaign owner or team admin can delete
        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            select: { id: true, team_id: true, is_admin: true, is_account_admin: true },
        });

        if (campaign.user !== session.user.id && !user?.is_admin && !user?.is_account_admin) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        // 1. Get all outreach items to find affected leads
        const outreachItems = await prisma.crm_Outreach_Items.findMany({
            where: { campaign: sequenceId },
            select: { id: true, lead: true },
        });

        const leadIds = Array.from(new Set(outreachItems.map((i: any) => i.lead).filter(Boolean))) as string[];

        // 2. Delete all outreach items for this campaign
        await prisma.crm_Outreach_Items.deleteMany({
            where: { campaign: sequenceId },
        });

        systemLogger.info(`[CAMPAIGN_DELETE] Deleted ${outreachItems.length} outreach items for campaign ${sequenceId}`);

        // 3. Reset leads that were part of this campaign
        if (leadIds.length > 0) {
            await prisma.crm_Leads.updateMany({
                where: { id: { in: leadIds } },
                data: {
                    outreach_status: "IDLE" as any,
                    outreach_sent_at: null,
                    outreach_opened_at: null,
                    outreach_meeting_booked_at: null,
                    outreach_first_message_id: null,
                    outreach_open_token: null,
                    pipeline_stage: "Identify" as any,
                },
            });
            systemLogger.info(`[CAMPAIGN_DELETE] Reset ${leadIds.length} leads for campaign ${sequenceId}`);
        }

        // 4. Cancel all CRON jobs linked to this campaign
        const cronResult = await prisma.crm_Cron_Jobs.updateMany({
            where: { campaign_id: sequenceId, status: { not: "COMPLETED" as any } },
            data: { status: "COMPLETED" as any },
        });

        systemLogger.info(`[CAMPAIGN_DELETE] Cancelled ${cronResult.count} cron jobs for campaign ${sequenceId}`);

        // 5. Delete the campaign record
        await prisma.crm_Outreach_Campaigns.delete({
            where: { id: sequenceId },
        });

        systemLogger.info(`[CAMPAIGN_DELETE] Successfully deleted campaign ${sequenceId}`);

        return NextResponse.json({
            message: "Campaign deleted",
            cleaned: {
                outreachItems: outreachItems.length,
                leadsReset: leadIds.length,
                cronJobsCancelled: cronResult.count,
            },
        });
    } catch (error: any) {
        systemLogger.error("[CAMPAIGN_DELETE]", error);
        return NextResponse.json(
            { message: error.message || "Failed to delete campaign" },
            { status: 500 }
        );
    }
}
