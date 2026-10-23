"use server";

import { dbAdapter } from "@/lib/database/db-adapter";
import { prismadb } from "@/lib/prisma";
import { addRawXP } from "@/actions/quests/add-raw-xp";
import { ObjectId } from "mongodb";

// Master lookup of XP values matching CertificationPaths.tsx
const LEVEL_XP_REWARDS: Record<number, number> = {
    1: 50,
    2: 50,
    3: 100,
    4: 100,
    5: 150,
    6: 200,
    7: 250,
    8: 150,
    9: 300,
    10: 200,
    11: 200,
    12: 500,
    13: 150,
    14: 300,
    15: 400,
    16: 600,
    17: 450,
    18: 500,
    19: 400,
    20: 550,
    21: 750,
    22: 600,
    23: 1000,
    24: 1200,
    25: 2500
};

// Which module should be temporarily unlocked at which level
const LEVEL_MODULE_UNLOCKS: Record<number, string> = {
    11: "campaigns", // Outreach Architect starts
    16: "workflows", // Automation Specialist starts
};

async function evaluateSingleLevel(
    level: number,
    userId: string,
    user: any,
    metrics: Set<string>
): Promise<{ flags: Record<string, boolean>; tasksDoneCount: number }> {
    const resultFlags: Record<string, boolean> = {};

    if (level === 1) {
        const hasAvatar = !!user.avatar || metrics.has("uploaded_avatar") || metrics.has("avatar");
        const viewedDashboard = metrics.has("viewed_dashboard") || metrics.has("dashboard");
        const updatedTimezone = metrics.has("updated_timezone") || metrics.has("viewed_settings") || metrics.has("timezone");

        resultFlags["avatar"] = hasAvatar;
        resultFlags["dashboard"] = viewedDashboard;
        resultFlags["timezone"] = updatedTimezone;
    } else if (level === 2) {
        const realUser = await prismadb.users.findUnique({ where: { id: userId } });
        const hasSignature = (!!realUser?.signature_html && realUser.signature_html.length > 5) || metrics.has("signature");
        const hasSentMessage = !!(await prismadb.internalMessage.findFirst({
            where: { sender_id: userId }
        })) || metrics.has("message");
        const viewedNotifs = metrics.has("viewed_notifications") || metrics.has("updated_notification_settings") || metrics.has("notifications");

        resultFlags["signature"] = hasSignature;
        resultFlags["message"] = hasSentMessage;
        resultFlags["notifications"] = viewedNotifs;
    } else if (level === 3) {
        const hasLeadOrContact =
            !!(await prismadb.crm_Leads.findFirst({
                where: { OR: [{ createdBy: userId }, { assigned_to: userId }] }
            })) ||
            !!(await prismadb.crm_Contacts.findFirst({
                where: { OR: [{ createdBy: userId }, { created_by: userId }, { assigned_to: userId }] }
            })) ||
            metrics.has("lead_created");

        const hasNote =
            !!(await prismadb.crm_Lead_Activities.findFirst({
                where: { user: userId, type: "note" }
            })) || metrics.has("note_created");

        const updatedContact =
            !!(await prismadb.crm_Contacts.findFirst({
                where: { OR: [{ updatedBy: userId }, { last_activity_by: userId }] }
            })) || metrics.has("contact_updated");

        resultFlags["lead_created"] = hasLeadOrContact;
        resultFlags["note_created"] = hasNote;
        resultFlags["contact_updated"] = updatedContact;
    } else if (level === 4) {
        const hasCreatedTask =
            !!(await prismadb.tasks.findFirst({
                where: { OR: [{ user: userId }, { createdBy: userId }] }
            })) || metrics.has("created_task");

        const hasCompletedTask =
            !!(await prismadb.tasks.findFirst({
                where: { OR: [{ user: userId }, { createdBy: userId }], taskStatus: "COMPLETE" }
            })) || metrics.has("completed_task");

        const linkedTask =
            !!(await prismadb.tasks.findFirst({
                where: { OR: [{ user: userId }, { createdBy: userId }], opportunityId: { not: null } }
            })) || metrics.has("linked_task");

        resultFlags["created_task"] = hasCreatedTask;
        resultFlags["completed_task"] = hasCompletedTask;
        resultFlags["linked_task"] = linkedTask;
    } else if (level === 5) {
        resultFlags["global_search"] = metrics.has("used_global_search") || metrics.has("global_search");
        resultFlags["custom_filter"] = metrics.has("used_custom_filter") || metrics.has("custom_filter");
        resultFlags["bookmark"] = metrics.has("saved_bookmark") || metrics.has("bookmark");
    } else if (level === 6) {
        const hasOppy =
            !!(await prismadb.crm_Opportunities.findFirst({
                where: { OR: [{ createdBy: userId }, { created_by: userId }, { assigned_to: userId }] }
            })) || metrics.has("opportunity_created");

        const hasOppyValueOrContact =
            !!(await prismadb.crm_Opportunities.findFirst({
                where: {
                    OR: [{ createdBy: userId }, { created_by: userId }, { assigned_to: userId }],
                    AND: [
                        {
                            OR: [
                                { budget: { gt: 0 } },
                                { expected_revenue: { gt: 0 } },
                                { contact: { not: null } }
                            ]
                        }
                    ]
                }
            })) || metrics.has("opportunity_contact");

        const hasMoved = metrics.has("opportunity_moved");

        resultFlags["opportunity_created"] = hasOppy;
        resultFlags["opportunity_contact"] = hasOppyValueOrContact;
        resultFlags["opportunity_moved"] = hasMoved;
    } else if (level === 7) {
        const hasNextStepInDb = !!(await prismadb.crm_Opportunities.findFirst({
            where: {
                OR: [{ createdBy: userId }, { assigned_to: userId }],
                next_step: { not: null }
            }
        }));

        resultFlags["kanban_filtered"] = metrics.has("kanban_filtered");
        resultFlags["opportunity_tagged"] = metrics.has("opportunity_tagged");
        resultFlags["opportunity_next_step"] = metrics.has("opportunity_next_step") || hasNextStepInDb;
    } else if (level === 8) {
        const emailConnected =
            !!(await prismadb.crm_Emails.findFirst({ where: { user_id: userId } })) ||
            !!(await prismadb.gmail_Tokens.findFirst({ where: { user: userId } })) ||
            !!(await prismadb.microsoft_Tokens.findFirst({ where: { user: userId } })) ||
            !!user.sesEmailVerified ||
            metrics.has("email_connected");

        const emailSent =
            metrics.has("sent_crm_email") ||
            metrics.has("email_sent") ||
            !!(await prismadb.crm_Emails.findFirst({ where: { user_id: userId, is_inbound: false } }));

        const emailTemplate =
            metrics.has("email_template") ||
            !!user.outreach_prompt_default ||
            !!(await prismadb.crm_Outreach_Campaigns.findFirst({ where: { user: userId } }));

        resultFlags["email_connected"] = emailConnected;
        resultFlags["email_sent"] = emailSent;
        resultFlags["email_template"] = emailTemplate;
    } else if (level === 9) {
        const calendarConnected =
            (Array.isArray(user.calendar_selected_ids) && user.calendar_selected_ids.length > 0) ||
            !!(await prismadb.gmail_Tokens.findFirst({ where: { user: userId } })) ||
            !!(await prismadb.microsoft_Tokens.findFirst({ where: { user: userId } })) ||
            metrics.has("calendar_connected");

        const meetingLink = metrics.has("shared_booking_link") || metrics.has("meeting_link") || !!user.meeting_link;
        const meetingNote =
            !!(await prismadb.crm_Lead_Activities.findFirst({
                where: { user: userId, type: { in: ["meeting_note", "meeting", "call"] } }
            })) || metrics.has("meeting_note");

        resultFlags["calendar_connected"] = calendarConnected;
        resultFlags["meeting_link"] = meetingLink;
        resultFlags["meeting_note"] = meetingNote;
    } else if (level === 10) {
        resultFlags["mention_user"] = metrics.has("mentioned_user") || metrics.has("mention_user");
        resultFlags["reassign_record"] = metrics.has("reassigned_record") || metrics.has("reassign_record");
        resultFlags["share_record"] = metrics.has("shared_record_link") || metrics.has("share_record");
    } else if (level === 11) {
        const hasCampaign =
            !!(await prismadb.crm_Outreach_Campaigns.findFirst({
                where: { OR: [{ user: userId }, { assigned_users: { has: userId } }] }
            })) || metrics.has("campaign_contact_added");

        const reviewedMetrics =
            metrics.has("campaign_metrics_reviewed") ||
            !!(await prismadb.crm_Outreach_Campaigns.findFirst({
                where: { OR: [{ user: userId }, { assigned_users: { has: userId } }], emails_sent: { gt: 0 } }
            }));

        const modifiedProspect =
            metrics.has("prospect_state_modified") ||
            !!(await prismadb.crm_Leads.findFirst({
                where: { OR: [{ updatedBy: userId }, { assigned_to: userId }], status: { not: "NEW" } }
            }));

        resultFlags["campaign_contact_added"] = hasCampaign;
        resultFlags["campaign_metrics_reviewed"] = reviewedMetrics;
        resultFlags["prospect_state_modified"] = modifiedProspect;
    } else if (level === 12) {
        const mergedDuplicate = metrics.has("duplicate_merged");
        const contactsCount = await prismadb.crm_Contacts.count({
            where: { OR: [{ updatedBy: userId }, { createdBy: userId }, { created_by: userId }] }
        });
        const enriched10 = metrics.has("records_enriched_10") || contactsCount >= 10;
        const archivedStale =
            metrics.has("stale_leads_archived") ||
            !!(await prismadb.crm_Leads.findFirst({
                where: {
                    OR: [{ updatedBy: userId }, { assigned_to: userId }],
                    status: { in: ["LOST", "ARCHIVED", "DISQUALIFIED"] }
                }
            }));

        resultFlags["duplicate_merged"] = mergedDuplicate;
        resultFlags["records_enriched_10"] = enriched10;
        resultFlags["stale_leads_archived"] = archivedStale;
    } else if (level === 13) {
        const reviewedPool =
            !!(await prismadb.crm_Lead_Pools.findFirst({
                where: { OR: [{ user: userId }, { assigned_members: { has: userId } }] }
            })) || metrics.has("lead_pool_reviewed");

        const savedIcp =
            !!(await prismadb.crm_Lead_Pools.findFirst({
                where: { user: userId, icpConfig: { not: null } }
            })) || metrics.has("icp_filter_saved");

        const viewedAccount =
            metrics.has("company_profile_viewed") ||
            !!(await prismadb.crm_Accounts.findFirst({
                where: { OR: [{ createdBy: userId }, { assigned_to: userId }] }
            }));

        resultFlags["lead_pool_reviewed"] = reviewedPool;
        resultFlags["icp_filter_saved"] = savedIcp;
        resultFlags["company_profile_viewed"] = viewedAccount;
    } else if (level === 14) {
        const dialerAccessed = metrics.has("dialer_accessed");
        const activityCount = await prismadb.crm_Lead_Activities.count({ where: { user: userId } });
        const processed5 = metrics.has("queue_processed_5") || activityCount >= 5;
        const voicemailDropped =
            metrics.has("voicemail_dropped") ||
            !!(await prismadb.crm_Lead_Activities.findFirst({
                where: { user: userId, channel: "CALL" }
            }));

        resultFlags["dialer_accessed"] = dialerAccessed;
        resultFlags["queue_processed_5"] = processed5;
        resultFlags["voicemail_dropped"] = voicemailDropped;
    } else if (level === 15) {
        const quoteGenerated =
            !!(await prismadb.crm_Quotes.findFirst({ where: { createdBy: userId } })) ||
            metrics.has("quote_generated");

        const contractSent =
            !!(await prismadb.crm_Contracts.findFirst({
                where: { OR: [{ createdBy: userId }, { assigned_to: userId }] }
            })) || metrics.has("contract_sent");

        const agreementReviewed =
            !!(await prismadb.crm_Contracts.findFirst({
                where: {
                    OR: [{ createdBy: userId }, { assigned_to: userId }],
                    status: { in: ["INPROGRESS", "SIGNED"] }
                }
            })) || metrics.has("agreement_reviewed");

        resultFlags["quote_generated"] = quoteGenerated;
        resultFlags["contract_sent"] = contractSent;
        resultFlags["agreement_reviewed"] = agreementReviewed;
    } else if (level === 16) {
        const workflowsVisited =
            metrics.has("workflows_visited") ||
            !!(await prismadb.crm_Workflow.findFirst({ where: { created_by: userId } }));

        const nodesReviewed =
            metrics.has("workflow_nodes_reviewed") ||
            !!(await prismadb.crm_Workflow.findFirst({
                where: { created_by: userId, status: "ACTIVE" }
            }));

        const workflowTriggered =
            metrics.has("workflow_triggered") ||
            !!(await prismadb.crm_Workflow_Execution.findFirst({
                where: { workflow: { created_by: userId } }
            }));

        resultFlags["workflows_visited"] = workflowsVisited;
        resultFlags["workflow_nodes_reviewed"] = nodesReviewed;
        resultFlags["workflow_triggered"] = workflowTriggered;
    } else if (level === 17) {
        const leadsCount = await prismadb.crm_Leads.count({
            where: { OR: [{ createdBy: userId }, { assigned_to: userId }] }
        });
        const bulkEdit20 = metrics.has("bulk_edit_20") || leadsCount >= 20;
        const buttonSetsCount = await prismadb.project_Button_Sets.count({ where: { owner: userId } });
        const macroCreated = metrics.has("macro_created") || !!user.resource_links || buttonSetsCount > 0;
        const widgetCustomized =
            metrics.has("widget_customized") ||
            !!(await prismadb.dashboardPreference.findFirst({ where: { userId } }));

        resultFlags["bulk_edit_20"] = bulkEdit20;
        resultFlags["macro_created"] = macroCreated;
        resultFlags["widget_customized"] = widgetCustomized;
    } else if (level === 18) {
        const forecastReviewed =
            metrics.has("forecast_reviewed") ||
            !!(await prismadb.savedReport.findFirst({ where: { userId } }));

        const dealProbSet =
            metrics.has("deal_probability_set") ||
            !!(await prismadb.crm_Opportunities.findFirst({
                where: {
                    OR: [{ createdBy: userId }, { assigned_to: userId }],
                    expected_revenue: { gt: 0 }
                }
            }));

        const wonDeal1000 =
            metrics.has("won_deal_1000") ||
            !!(await prismadb.crm_Opportunities.findFirst({
                where: {
                    OR: [{ createdBy: userId }, { assigned_to: userId }],
                    status: "CLOSED",
                    budget: { gte: 1000 }
                }
            }));

        resultFlags["forecast_reviewed"] = forecastReviewed;
        resultFlags["deal_probability_set"] = dealProbSet;
        resultFlags["won_deal_1000"] = wonDeal1000;
    } else if (level === 19) {
        const aiEmailDrafted =
            metrics.has("ai_email_drafted") ||
            !!(await prismadb.crm_AiUsageLog.findFirst({ where: { user_id: userId } }));

        const aiThreadSummary =
            metrics.has("ai_thread_summary") ||
            !!(await prismadb.chat_Sessions.findFirst({ where: { user: userId } }));

        const usedPromptLab = metrics.has("used_prompt_lab") || !!user.outreach_prompt_default;

        resultFlags["ai_email_drafted"] = aiEmailDrafted;
        resultFlags["ai_thread_summary"] = aiThreadSummary;
        resultFlags["used_prompt_lab"] = usedPromptLab;
    } else if (level === 20) {
        const wonDealToCustomer =
            metrics.has("won_deal_to_customer") ||
            !!(await prismadb.boards.findFirst({
                where: { OR: [{ user: userId }, { createdBy: userId }] }
            }));

        const supportCaseHandled =
            !!(await prismadb.crm_Cases.findFirst({
                where: { OR: [{ createdBy: userId }, { assigned_to: userId }] }
            })) ||
            !!(await prismadb.crm_Case_Comments.findFirst({
                where: { author_id: userId }
            })) ||
            metrics.has("support_case_handled");

        const clientCheckinLogged =
            metrics.has("client_checkin_logged") ||
            !!(await prismadb.crm_Lead_Activities.findFirst({
                where: { user: userId, contact: { not: null } }
            }));

        resultFlags["won_deal_to_customer"] = wonDealToCustomer;
        resultFlags["support_case_handled"] = supportCaseHandled;
        resultFlags["client_checkin_logged"] = clientCheckinLogged;
    } else if (level === 21) {
        const closedDealsCount = await prismadb.crm_Opportunities.count({
            where: {
                OR: [{ createdBy: userId }, { assigned_to: userId }],
                status: "CLOSED"
            }
        });
        resultFlags["closed_5_deals"] = metrics.has("closed_5_deals") || closedDealsCount >= 5;
        resultFlags["win_rate_above_avg"] = metrics.has("win_rate_above_avg");
        resultFlags["reactivated_lost_deal"] = metrics.has("reactivated_lost_deal");
    } else if (level === 22) {
        const completedModule = metrics.has("completed_training_module");
        const documentedPractice =
            metrics.has("documented_best_practice") ||
            !!(await prismadb.knowledgeArticle.findFirst({ where: { author_id: userId } }));
        const templateAdopted = metrics.has("template_adopted");

        resultFlags["completed_training_module"] = completedModule;
        resultFlags["documented_best_practice"] = documentedPractice;
        resultFlags["template_adopted"] = templateAdopted;
    } else if (level === 23) {
        const customReportBuilt =
            !!(await prismadb.savedReport.findFirst({ where: { userId } })) ||
            metrics.has("custom_report_built");

        resultFlags["custom_report_built"] = customReportBuilt;
        resultFlags["segmented_list_exported"] = metrics.has("segmented_list_exported");
        resultFlags["funnel_dropoff_identified"] = metrics.has("funnel_dropoff_identified");
    } else if (level === 24) {
        resultFlags["hit_activity_targets"] = metrics.has("hit_activity_targets");
        resultFlags["upsell_uncovered"] = metrics.has("upsell_uncovered");
        resultFlags["closure_under_14_days"] = metrics.has("closure_under_14_days");
    } else if (level >= 25) {
        const commsCount = await prismadb.crm_Lead_Activities.count({ where: { user: userId } });
        resultFlags["logged_500_comms"] = metrics.has("logged_500_comms") || commsCount >= 500;
        resultFlags["high_csat_metrics"] = metrics.has("high_csat_metrics");
        resultFlags["hygiene_30_days"] = metrics.has("hygiene_30_days");
    }

    const tasksDoneCount = Object.values(resultFlags).filter(Boolean).length;
    return { flags: resultFlags, tasksDoneCount };
}

export async function evaluateMasteryProgress(userId: string) {
    try {
        const usersCol = await dbAdapter.getNativeCollection("Users");
        const user = await usersCol.findOne({ _id: new ObjectId(userId) });
        if (!user) return null;

        let currentLevel = Math.min(Math.max(user.university_level || 1, 1), 25);
        let claimedLevels: number[] = Array.isArray(user.university_claimed_levels) ? [...user.university_claimed_levels] : [];
        const teamId = user.team_id || user.current_team_id;

        // Self-healing: if currentLevel is 1, they shouldn't have claimed Level 1 XP yet
        if (currentLevel === 1 && claimedLevels.includes(1)) {
            await usersCol.updateOne({ _id: new ObjectId(userId) }, { $pull: { university_claimed_levels: 1 } } as any);
            claimedLevels = claimedLevels.filter((lvl: number) => lvl !== 1);
        }

        // Backfill missing XP for levels they already passed
        for (let l = 1; l < currentLevel; l++) {
            if (!claimedLevels.includes(l)) {
                await usersCol.updateOne({ _id: new ObjectId(userId) }, { $push: { university_claimed_levels: l } } as any);
                await addRawXP({ userId, xpAmount: LEVEL_XP_REWARDS[l] || 100, reason: `Level ${l} Completed (Retroactive)` });
                claimedLevels.push(l);
            }
        }

        // Fetch all user metrics once for fast evaluation
        const userMetricsRows = await prismadb.userMetrics.findMany({
            where: { userId },
            select: { metricKey: true }
        });
        const metricsSet = new Set<string>(userMetricsRows.map((m) => m.metricKey));

        let leveledUp = false;
        let resultFlags: Record<string, boolean> = {};
        const totalTasks = 3;

        // Evaluate current level and cascade if multiple levels are already completed
        for (let safety = 0; safety < 25; safety++) {
            const evalRes = await evaluateSingleLevel(currentLevel, userId, user, metricsSet);
            resultFlags = evalRes.flags;

            if (evalRes.tasksDoneCount === totalTasks) {
                // Grant XP for currentLevel if not yet claimed
                if (!claimedLevels.includes(currentLevel)) {
                    await usersCol.updateOne(
                        { _id: new ObjectId(userId) },
                        { $push: { university_claimed_levels: currentLevel } } as any
                    );
                    await addRawXP({
                        userId,
                        xpAmount: LEVEL_XP_REWARDS[currentLevel] || 100,
                        reason: `University Level ${currentLevel} Completed`
                    });
                    claimedLevels.push(currentLevel);
                }

                if (currentLevel < 25) {
                    currentLevel += 1;
                    leveledUp = true;

                    await usersCol.updateOne(
                        { _id: new ObjectId(userId) },
                        { $set: { university_level: currentLevel } } as any
                    );

                    // Temporary module unlock logic
                    const requiredModuleToUnlock = LEVEL_MODULE_UNLOCKS[currentLevel];
                    if (requiredModuleToUnlock && teamId) {
                        try {
                            const teamsCol = await dbAdapter.getNativeCollection("Team");
                            const expiry = new Date();
                            expiry.setDate(expiry.getDate() + 14); // 14 Days

                            await teamsCol.updateOne(
                                { _id: new ObjectId(teamId.toString()) },
                                {
                                    $push: {
                                        temporary_modules: {
                                            module: requiredModuleToUnlock,
                                            expires_at: expiry
                                        }
                                    }
                                } as any
                            );
                        } catch (unlockErr) {
                            console.warn("Failed to unlock temporary module:", unlockErr);
                        }
                    }
                    // Continue loop to evaluate the newly unlocked level's flags!
                    continue;
                } else {
                    // Completed Level 25 (Grandmaster)! Keep currentLevel at 25 with all 3 flags true
                    break;
                }
            } else {
                break;
            }
        }

        return {
            level: currentLevel,
            flags: resultFlags,
            leveledUp,
            claimedLevels,
            partnerProfile: user.partner_profile || null
        };
    } catch (e) {
        console.error("Failed to evaluate mastery:", e);
        return null;
    }
}
