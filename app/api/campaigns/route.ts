import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbCrm as prisma } from "@/lib/prisma-crm";
import { registerCronJob } from "@/lib/cron-scheduler";
import { systemLogger } from "@/lib/logger";
import { OutreachItemStatus } from "@prisma/client";

// PUT - Update an existing sequence (used for draft auto-save)
export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            id,
            name,
            description,
            channels,
            leadIds,
            poolId,
            projectId,
            promptTemplate,
            promptOverride,
            signatureHtml,
            resourceLinks,
            meetingLink,
            includeResearch,
            status,
            config, // Wizard state for drafts
        } = body;

        if (!id) {
            return NextResponse.json(
                { message: "Sequence ID is required for update" },
                { status: 400 }
            );
        }

        // Verify the campaign exists and belongs to the user's team
        const existingCampaign = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id },
        });

        if (!existingCampaign) {
            return NextResponse.json(
                { message: "Sequence not found" },
                { status: 404 }
            );
        }

        // Update the campaign
        const campaign = await prisma.crm_Outreach_Campaigns.update({
            where: { id },
            data: {
                name: name || existingCampaign.name,
                description: description ?? existingCampaign.description,
                status: status || existingCampaign.status,
                project: projectId ?? existingCampaign.project,
                pool: poolId ?? existingCampaign.pool,
                prompt_override: promptTemplate || promptOverride || existingCampaign.prompt_override,
                signature_html: signatureHtml ?? existingCampaign.signature_html,
                resource_links: resourceLinks ?? existingCampaign.resource_links,
                meeting_link: meetingLink ?? existingCampaign.meeting_link,
                channels: channels || existingCampaign.channels,
                total_leads: leadIds?.length ?? existingCampaign.total_leads,
                // Store wizard config as JSON in signature_meta field (reusing available JSON field)
                signature_meta: config ?? existingCampaign.signature_meta,
                updatedAt: new Date(),
            },
        });

        // If lead IDs changed for a DRAFT campaign, update the outreach items
        if (leadIds && status === "DRAFT") {
            // Delete existing outreach items for this campaign
            await prisma.crm_Outreach_Items.deleteMany({
                where: { campaign: id },
            });

            // Create new outreach items
            const outreachItems = [];
            for (const leadId of leadIds) {
                for (const channel of (channels || existingCampaign.channels || ["EMAIL"])) {
                    outreachItems.push({
                        campaign: id,
                        lead: leadId,
                        channel,
                        status: OutreachItemStatus.PENDING,
                        retry_count: 0,
                    });
                }
            }

            if (outreachItems.length > 0) {
                await prisma.crm_Outreach_Items.createMany({
                    data: outreachItems,
                });
            }
        }

        return NextResponse.json({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            totalLeads: campaign.total_leads,
            message: "Sequence updated successfully",
        });
    } catch (error: any) {
        console.error("Error updating campaign:", error);
        return NextResponse.json(
            { message: error.message || "Failed to update sequence" },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            name,
            title, // Accept title as alias for name (from project-style forms)
            description,
            channels,
            leadIds,
            poolId,
            projectId,
            promptOverride,
            signatureHtml,
            resourceLinks,
            meetingLink,
            includeResearch,
            status,
            // Campaign-specific fields
            product_focus,       // Which product line this campaign targets (e.g. "BasaltSURGE")
            campaign_brief,      // Strategic brief / mission for this campaign
            messaging_tone,      // formal, casual, technical, executive
            target_industries,   // ICP industries
            target_geos,         // ICP geographies
            target_titles,       // ICP job titles
            key_value_props,     // Key value propositions for the campaign
            followupConfig,      // { enabled, delayHours, maxCount, prompt }
            brandId,             // Specific brand identity selected in the wizard
            campaignBranding,    // Template and brand overrides from the wizard
            voiceConfig,         // { agentId, startTime, concurrency } for ElevenLabs Voice
        } = body;

        // Resolve name from either field
        const campaignName = name || title;

        if (!campaignName) {
            return NextResponse.json(
                { message: "Campaign name is required" },
                { status: 400 }
            );
        }

        // Get user's team — always needed for tenant scoping
        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            select: { team_id: true, name: true },
        });

        // Fetch brand identity — use specific brandId from wizard, or fall back to default
        let defaultBranding: any = null;
        if (user?.team_id) {
            const teamBrand = brandId
                ? await prisma.teamBrandIdentity.findFirst({
                    where: { id: brandId, team_id: user.team_id }
                })
                : await prisma.teamBrandIdentity.findFirst({
                    where: { team_id: user.team_id, is_default: true }
                });
            if (teamBrand) {
                const { id, team_id, setup_completed, createdAt, updatedAt, ...brandProps } = teamBrand;
                defaultBranding = {
                    ...brandProps,
                    // If a specific product is selected, include it in the branding snapshot
                    ...(product_focus ? { product_focus } : {}),
                    // Campaign-specific ICP overrides (if provided, override brand defaults)
                    ...(campaign_brief ? { campaign_brief } : {}),
                    ...(messaging_tone ? { messaging_tone } : {}),
                    ...(target_industries?.length ? { target_industries } : {}),
                    ...(target_geos?.length ? { target_geos } : {}),
                    ...(target_titles?.length ? { target_titles } : {}),
                    ...(key_value_props?.length ? { key_value_props } : {}),
                };
            }
        }

        // Use provided status or default to DRAFT
        const campaignStatus = status || "DRAFT";

        // Always create crm_Outreach_Campaigns — the proper campaign model
        const campaign = await prisma.crm_Outreach_Campaigns.create({
            data: {
                name: campaignName,
                description: description || null,
                status: campaignStatus,
                user: session.user.id,
                team_id: user?.team_id || null,
                project: projectId || null,
                pool: poolId || null,
                prompt_override: promptOverride || null,
                signature_html: signatureHtml || null,
                signature_meta: null,
                resource_links: resourceLinks || null,
                meeting_link: meetingLink || null,
                campaign_branding: campaignBranding 
                  ? { ...(defaultBranding || {}), ...campaignBranding } 
                  : (defaultBranding || null),
                channels: channels || ["EMAIL"],
                total_leads: leadIds?.length || 0,
                emails_sent: 0,
                emails_opened: 0,
                sms_sent: 0,
                sms_delivered: 0,
                calls_initiated: 0,
                meetings_booked: 0,
                // Follow-up automation config
                followup_enabled: followupConfig?.enabled ?? true,
                followup_delay_hours: followupConfig?.delayHours ?? 72,
                followup_max_count: followupConfig?.maxCount ?? 2,
                followup_prompt: followupConfig?.prompt || null,
                // Voice configuration
                voice_agent_id: voiceConfig?.agentId || null,
                voice_start_time: voiceConfig?.startTime ? new Date(voiceConfig.startTime) : null,
                voice_concurrency_limit: voiceConfig?.concurrency || 2,
                voice_prompt: voiceConfig?.prompt || null,
            },
        });

        // NOTE: Lead-level outreach_status is NOT reset here. The send route
        // (POST /api/outreach/send) overwrites outreach_status to "SENT" for each
        // lead as emails are dispatched. Old campaign data in crm_Outreach_Items
        // remains untouched — each campaign tracks replies/opens via its own items.

        // Register CRON job for auto follow-ups if enabled
        if (followupConfig?.enabled && user?.team_id) {
            try {
                await registerCronJob({
                    teamId: user.team_id,
                    userId: session.user.id,
                    jobType: "AUTO_FOLLOWUP",
                    label: `Follow-up: ${campaignName}`,
                    campaignId: campaign.id,
                    intervalMs: 3600000, // Check every hour
                });
                systemLogger.info(`[CAMPAIGN_POST] Registered follow-up CRON job for campaign ${campaign.id}`);
            } catch (cronErr: any) {
                systemLogger.warn(`[CAMPAIGN_POST] Failed to register follow-up CRON job: ${cronErr?.message}`);
            }
        }

        // Register CRON job for Voice Batching if PHONE channel is used
        if (channels?.includes("PHONE") && user?.team_id) {
            try {
                await registerCronJob({
                    teamId: user.team_id,
                    userId: session.user.id,
                    jobType: "VOICE_BATCH",
                    label: `Voice Dispatch: ${campaignName}`,
                    campaignId: campaign.id,
                    intervalMs: 60000, // Voice batcher runs every minute globally, but we set to 1m for UI representation
                });
                systemLogger.info(`[CAMPAIGN_POST] Registered voice batch CRON job for campaign ${campaign.id}`);
            } catch (cronErr: any) {
                systemLogger.warn(`[CAMPAIGN_POST] Failed to register voice CRON job: ${cronErr?.message}`);
            }
        }

        // If leads were provided AND status is DRAFT, pre-create outreach items
        // as a planning manifest. For ACTIVE campaigns (wizard launches), skip
        // pre-creation — the send route creates fully-populated SENT items with
        // subject, body, message_id, and tracking_token. Pre-creating PENDING
        // items for ACTIVE campaigns caused duplicates and inflated total_leads.
        if (leadIds && leadIds.length > 0 && campaignStatus === "DRAFT") {
            // Filter: only valid 24-char hex ObjectIDs can be stored in the `lead` field
            const validLeadIds = leadIds.filter((id: string) => /^[a-f0-9]{24}$/i.test(id));

            if (validLeadIds.length > 0) {
                // Fetch leads and accounts to get their primary and additional emails
                const [dbLeads, dbAccounts] = await Promise.all([
                    prisma.crm_Leads.findMany({
                        where: { id: { in: validLeadIds } },
                        select: { id: true, email: true, additional_emails: true }
                    }),
                    prisma.crm_Accounts.findMany({
                        where: { id: { in: validLeadIds } },
                        select: { id: true, email: true, additional_emails: true }
                    })
                ]);

                const dbRecords = new Map<string, { email: string | null, additional_emails: string[] }>();
                dbLeads.forEach((l: any) => dbRecords.set(l.id, { email: l.email, additional_emails: l.additional_emails || [] }));
                // Accounts might overwrite leads if they share an ID (impossible for ObjectIDs, but safe)
                dbAccounts.forEach((a: any) => dbRecords.set(a.id, { email: a.email, additional_emails: a.additional_emails || [] }));

                const outreachItems = [];
                for (const leadId of validLeadIds) {
                    const record = dbRecords.get(leadId);
                    
                    for (const channel of (channels || ["EMAIL"])) {
                        // Create primary item
                        outreachItems.push({
                            campaign: campaign.id,
                            lead: leadId,
                            channel,
                            status: OutreachItemStatus.PENDING,
                            retry_count: 0,
                        });

                        // If the channel is EMAIL and we have additional emails, create dedicated items for them
                        if (channel === "EMAIL" && record?.additional_emails && record.additional_emails.length > 0) {
                            for (const extraEmail of record.additional_emails) {
                                if (!extraEmail || !extraEmail.includes("@")) continue;
                                outreachItems.push({
                                    campaign: campaign.id,
                                    lead: leadId, // Links back to the same lead/account
                                    channel,
                                    status: OutreachItemStatus.PENDING,
                                    retry_count: 0,
                                    candidate_email: extraEmail, // Specifies exactly which email to target
                                });
                            }
                        }
                    }
                }

                // Batch create outreach items
                if (outreachItems.length > 0) {
                    await prisma.crm_Outreach_Items.createMany({
                        data: outreachItems,
                    });
                }
            }
        }

        // Log activity for all valid lead IDs (both DRAFT and ACTIVE)
        if (leadIds && leadIds.length > 0) {
            const validLeadIds = leadIds.filter((id: string) => /^[a-f0-9]{24}$/i.test(id));
            if (validLeadIds.length > 0) {
                await prisma.crm_Lead_Activities.createMany({
                    data: validLeadIds.map((leadId: string) => ({
                        lead: leadId,
                        user: session.user.id,
                        type: "CAMPAIGN_CREATED",
                        metadata: {
                            campaignId: campaign.id,
                            campaignName,
                        },
                    })),
                });
            }
        }

        import("@/actions/quests/add-raw-xp")
          .then((m) => m.addRawXP({ userId: session.user.id, xpAmount: 15, reason: "Configured Delivery Sequence" }))
          .catch((e) => systemLogger.warn(`[CREATE_CAMPAIGN_GAMIFICATION] Failed to award XP: ${e?.message}`));

        return NextResponse.json({
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
            totalLeads: campaign.total_leads,
            message: "Campaign created successfully",
        });
    } catch (error: any) {
        console.error("Error creating campaign:", error);
        return NextResponse.json(
            { message: error.message || "Failed to create campaign" },
            { status: 500 }
        );
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Get user's team and role
        const user = await prisma.users.findUnique({
            where: { id: session.user.id },
            select: { team_id: true, team_role: true, email: true },
        });

        const isMember = user?.team_role === "MEMBER";

        // Build where clause based on role
        let whereClause: any;
        if (isMember) {
            // Members: See only campaigns they created OR are assigned to
            whereClause = {
                OR: [
                    { user: session.user.id },
                    { assigned_users: { has: session.user.id } }
                ]
            };
        } else if (user?.team_id) {
            // Admins/Owners: See all team campaigns
            whereClause = { team_id: user.team_id };
        } else {
            // Fallback: Own campaigns only
            whereClause = { user: session.user.id };
        }

        // Fetch campaigns, emailWarmups and teamEmailConfig in parallel
        let campaigns: any[] = [];
        let emailWarmups: any[] = [];
        let teamEmailConfig: any = null;

        if (user?.team_id) {
            const results = await Promise.all([
                prisma.crm_Outreach_Campaigns.findMany({
                    where: whereClause,
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
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                }),
                prisma.emailWarmup.findMany({
                    where: { team_id: user.team_id }
                }),
                prisma.teamEmailConfig.findUnique({
                    where: { team_id_purpose: { team_id: user.team_id, purpose: "OUTREACH" } },
                    select: { smtp_user: true }
                })
            ]);
            campaigns = results[0];
            emailWarmups = results[1];
            teamEmailConfig = results[2];
        } else {
            campaigns = await prisma.crm_Outreach_Campaigns.findMany({
                where: whereClause,
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
                        },
                    },
                },
                orderBy: {
                    createdAt: "desc",
                },
            });
        }

        const campaignsWithWarmup = campaigns.map((campaign) => {
            const branding = (campaign.campaign_branding || {}) as any;
            const senderMode = branding.senderMode || "company";
            let warmupSenderEmail = user?.email || session.user.email || "";
            if (senderMode !== "personal" && teamEmailConfig?.smtp_user) {
                warmupSenderEmail = teamEmailConfig.smtp_user;
            }

            let warmupInfo = null;
            if (user?.team_id && warmupSenderEmail && campaign.channels.includes("EMAIL")) {
                const wRecord = emailWarmups.find(
                    (w) => w.sender_email.toLowerCase() === warmupSenderEmail.toLowerCase()
                );
                if (wRecord) {
                    const now = new Date();
                    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                    const firstSendDay = new Date(Date.UTC(
                        wRecord.first_send_at.getUTCFullYear(),
                        wRecord.first_send_at.getUTCMonth(),
                        wRecord.first_send_at.getUTCDate()
                    ));
                    const daysActive = Math.floor((todayStart.getTime() - firstSendDay.getTime()) / (1000 * 60 * 60 * 24));
                    
                    if (daysActive < 6) {
                        let label = "Phase 1";
                        let limit = 20;
                        if (daysActive >= 2 && daysActive < 4) {
                            label = "Phase 2";
                            limit = 50;
                        } else if (daysActive >= 4 && daysActive < 6) {
                            label = "Phase 3";
                            limit = 100;
                        }
                        warmupInfo = {
                            phase: label,
                            dailyLimit: limit,
                            sentToday: wRecord.emails_sent_today,
                            daysActive
                        };
                    }
                }
            }

            return {
                ...campaign,
                warmup: warmupInfo
            };
        });

        return NextResponse.json({ campaigns: campaignsWithWarmup });
    } catch (error: any) {
        console.error("Error fetching campaigns:", error);
        return NextResponse.json(
            { message: error.message || "Failed to fetch sequences" },
            { status: 500 }
        );
    }
}
