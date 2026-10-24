import { getGmailClientForUser } from "@/lib/gmail";
import { getGraphClient } from "@/lib/microsoft";
import { prismadb } from "@/lib/prisma";
import { ensureContactForLead } from "@/actions/crm/lead-conversions";
import { analyzeReplySentiment } from "@/actions/crm/analyze-sentiment";
import { systemLogger } from "@/lib/logger";

/**
 * Syncs Gmail for a specific user
 */
export async function syncGmailForUser(userId: string, days: number = 7) {
    try {
        const gmail = await getGmailClientForUser(userId);
        if (!gmail) return { success: false, error: "Gmail not connected" };

        const profile = await gmail.users.getProfile({ userId: "me" });
        const myEmail = (profile.data.emailAddress || "").toLowerCase();

        const q = `from:me newer_than:${days}d`;
        const messageIds: string[] = [];
        const resp: any = await gmail.users.messages.list({ userId: "me", q, maxResults: 100 });
        const msgs = resp.data.messages || [];
        for (const m of msgs) if (m.id) messageIds.push(m.id);

        const threadIds = new Set<string>();
        for (const mid of messageIds) {
            const meta = await gmail.users.messages.get({ userId: "me", id: mid, format: "metadata", metadataHeaders: ["threadId"] });
            if (meta.data.threadId) threadIds.add(meta.data.threadId);
        }

        const replyDetails = new Map<string, { email: string, snippet: string, date: string, threadId: string, messageId: string }>();
        for (const tid of Array.from(threadIds)) {
            const th: any = await gmail.users.threads.get({ userId: "me", id: tid, format: "metadata", metadataHeaders: ["From", "Date"] });
            const messages = th.data.messages || [];
            for (const m of messages) {
                const headers = (m.payload?.headers || []).reduce((acc: any, h: any) => {
                    acc[h.name.toLowerCase()] = h.value;
                    return acc;
                }, {} as Record<string, string>);
                const from = (headers["from"] || "").toLowerCase();
                const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s@]+@[^\s@]+)/);
                const senderEmail = (emailMatch && emailMatch[1]) ? emailMatch[1] : (emailMatch ? emailMatch[0] : "");

                if (senderEmail && senderEmail !== myEmail) {
                    replyDetails.set(senderEmail, {
                        email: senderEmail,
                        snippet: m.snippet || "",
                        date: headers["date"] || new Date().toISOString(),
                        threadId: tid,
                        messageId: m.id || "",
                    });
                }
            }
        }

        let updatedCount = 0;
        for (const [senderEmail, detail] of Array.from(replyDetails.entries())) {
            let targetId = null;
            let targetType = "";
            let targetFirstName = "";
            let targetLastName = "";
            let targetCompany = "";
            let targetTeamId = "";
            let targetAccountId = "";

            // First check Leads
            const lead = await prismadb.crm_Leads.findFirst({ where: { email: senderEmail } });
            if (lead) {
                targetId = lead.id;
                targetType = "LEAD";
                targetFirstName = lead.firstName || "";
                targetLastName = lead.lastName || "";
                targetCompany = lead.company || "";
                targetTeamId = lead.team_id || "";
                targetAccountId = lead.accountsIDs?.[0] || "";
            } else {
                // If no lead, check Contacts
                const contact = await prismadb.crm_Contacts.findFirst({ where: { email: senderEmail } });
                if (!contact) continue; // Completely unknown sender, skip
                
                targetId = contact.id;
                targetType = "CONTACT";
                targetFirstName = contact.first_name || "";
                targetLastName = contact.last_name || "";
                targetCompany = ""; // contacts don't have direct company string usually
                targetTeamId = contact.team_id || "";
                targetAccountId = contact.assigned_accounts?.[0]?.id || "";
            }

            const existingActivity = await prismadb.crm_Lead_Activities.findFirst({
                where: {
                    lead: targetId,
                    type: "reply_received",
                    createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
                }
            });

            if (existingActivity) {
                const meta = existingActivity.metadata as any;
                if (meta?.threadId === detail.threadId) continue;
            }

            if (targetType === "LEAD") {
                await prismadb.crm_Leads.update({
                    where: { id: targetId },
                    data: { pipeline_stage: "Engage_Human" as any } as any,
                });
                await ensureContactForLead(targetId).catch(() => { });
            }

            await prismadb.crm_Lead_Activities.create({
                data: {
                    lead: targetId,
                    user: userId,
                    type: "reply_received",
                    metadata: {
                        from_email: senderEmail,
                        snippet: detail.snippet,
                        threadId: detail.threadId,
                        date: detail.date,
                        provider: "gmail"
                    } as any,
                },
            });

            // ─── Outreach Intelligence: Match reply → Sentiment → Opportunity ───
            try {
                // Find the outreach item for this lead/contact
                const outreachItem = await prismadb.crm_Outreach_Items.findFirst({
                    where: targetType === "LEAD" 
                      ? { lead: targetId, status: { in: ["SENT", "DELIVERED"] } }
                      : { contact_id: targetId, status: { in: ["SENT", "DELIVERED"] } },
                    orderBy: { sentAt: "desc" },
                    select: { id: true, campaign: true, subject: true, account_id: true, contact_id: true },
                });

                if (outreachItem) {
                    // Run AI sentiment analysis
                    const sentiment = await analyzeReplySentiment(
                        detail.snippet || "",
                        {
                            originalSubject: outreachItem.subject || undefined,
                            leadName: [targetFirstName, targetLastName].filter(Boolean).join(" "),
                            leadCompany: targetCompany || undefined,
                        },
                        userId,
                        {
                            teamId: targetTeamId,
                            outreachItemId: outreachItem.id,
                            messageId: detail.messageId,
                            provider: "gmail",
                        },
                    );

                    // Update outreach item with reply data
                    await prismadb.crm_Outreach_Items.update({
                        where: { id: outreachItem.id },
                        data: {
                            status: "REPLIED" as any,
                            repliedAt: new Date(),
                            reply_snippet: (detail.snippet || "").substring(0, 500),
                            reply_sentiment: sentiment.sentiment,
                            reply_analyzed_at: new Date(),
                        },
                    });

                    // Update lead outreach status based on sentiment
                    const newStatus = sentiment.sentiment === "POSITIVE" ? "REPLIED_POSITIVE"
                        : sentiment.sentiment === "NEGATIVE" ? "REPLIED_NEGATIVE" : undefined;
                    if (newStatus && targetType === "LEAD") {
                        await prismadb.crm_Leads.update({
                            where: { id: targetId },
                            data: { outreach_status: newStatus as any },
                        }).catch(() => { });
                    }

                    // POSITIVE: Auto-create opportunity
                    if (sentiment.sentiment === "POSITIVE") {
                        const accountId = outreachItem.account_id || targetAccountId;
                        if (accountId) {
                            const account = await prismadb.crm_Accounts.findUnique({
                                where: { id: accountId },
                                select: { name: true },
                            });

                            await prismadb.crm_Opportunities.create({
                                data: {
                                    v: 1,
                                    name: `Outreach: ${account?.name || targetCompany || "Unknown"}`,
                                    account: accountId,
                                    contact: outreachItem.contact_id || (targetType === "CONTACT" ? targetId : undefined),
                                    campaign: outreachItem.campaign || undefined,
                                    lead_id: targetType === "LEAD" ? targetId : undefined,
                                    assigned_to: userId,
                                    team_id: targetTeamId || undefined,
                                    status: "ACTIVE" as any,
                                    lead_source: "Outreach Campaign",
                                    description: `Auto-created from positive reply. AI reasoning: ${sentiment.reasoning}`,
                                } as any,
                            });

                            if (targetType === "LEAD") {
                                await prismadb.crm_Leads.update({
                                    where: { id: targetId },
                                    data: { pipeline_stage: "Offering" as any },
                                }).catch(() => { });
                            }

                            systemLogger.info(`[SYNC_EMAILS] Created opportunity for ${targetType} ${targetId} (POSITIVE reply)`);
                        }
                    }

                    // Update campaign stats if linked
                    if (outreachItem.campaign) {
                        const statUpdate: any = {};
                        if (sentiment.sentiment === "POSITIVE") statUpdate.meetings_booked = { increment: 1 };
                        await prismadb.crm_Outreach_Campaigns.update({
                            where: { id: outreachItem.campaign },
                            data: statUpdate,
                        }).catch(() => { });
                    }
                }
            } catch (sentimentErr: any) {
                systemLogger.warn(`[SYNC_EMAILS] Sentiment analysis failed for ${targetType} ${targetId}: ${sentimentErr?.message}`);
            }

            updatedCount++;
        }

        return { success: true, leadsUpdated: updatedCount };
    } catch (error: any) {
        console.error(`Gmail sync error for user ${userId}:`, error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Syncs Microsoft Outlook for a specific user
 */
export async function syncOutlookForUser(userId: string, days: number = 7) {
    try {
        const client = await getGraphClient(userId);
        if (!client) return { success: false, error: "Outlook not connected" };

        const me = await client.api("/me").select("mail,userPrincipalName").get();
        const myEmail = (me.mail || me.userPrincipalName || "").toLowerCase();

        const date = new Date();
        date.setDate(date.getDate() - days);
        const filterDate = date.toISOString();

        const messages = await client.api("/me/messages")
            .filter(`receivedDateTime ge ${filterDate}`)
            .select("from,subject,bodyPreview,receivedDateTime,conversationId,id")
            .top(50)
            .get();

        const replyDetails = new Map<string, { email: string, snippet: string, date: string, threadId: string, messageId: string }>();

        for (const msg of messages.value || []) {
            const fromEmail = msg.from?.emailAddress?.address?.toLowerCase();
            if (fromEmail && fromEmail !== myEmail) {
                replyDetails.set(fromEmail, {
                    email: fromEmail,
                    snippet: msg.bodyPreview || "",
                    date: msg.receivedDateTime,
                    threadId: msg.conversationId,
                    messageId: msg.id
                });
            }
        }

        let updatedCount = 0;
        for (const [senderEmail, detail] of Array.from(replyDetails.entries())) {
            let targetId = null;
            let targetType = "";

            // First check Leads
            const lead = await prismadb.crm_Leads.findFirst({ where: { email: senderEmail } });
            if (lead) {
                targetId = lead.id;
                targetType = "LEAD";
            } else {
                // If no lead, check Contacts
                const contact = await prismadb.crm_Contacts.findFirst({ where: { email: senderEmail } });
                if (!contact) continue; // Completely unknown sender, skip
                
                targetId = contact.id;
                targetType = "CONTACT";
            }

            const existingActivity = await prismadb.crm_Lead_Activities.findFirst({
                where: {
                    lead: targetId,
                    type: "reply_received",
                    createdAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
                }
            });

            if (existingActivity) {
                const meta = existingActivity.metadata as any;
                if (meta?.threadId === detail.threadId || meta?.messageId === detail.messageId) continue;
            }

            if (targetType === "LEAD") {
                await prismadb.crm_Leads.update({
                    where: { id: targetId },
                    data: { pipeline_stage: "Engage_Human" as any } as any
                });
                await ensureContactForLead(targetId).catch(() => { });
            }

            await prismadb.crm_Lead_Activities.create({
                data: {
                    lead: targetId,
                    user: userId,
                    type: "reply_received",
                    metadata: {
                        from_email: senderEmail,
                        snippet: detail.snippet,
                        threadId: detail.threadId,
                        messageId: detail.messageId,
                        date: detail.date,
                        provider: "outlook"
                    } as any
                }
            });
            updatedCount++;
        }
        return { success: true, leadsUpdated: updatedCount };
    } catch (error: any) {
        console.error(`Outlook sync error for user ${userId}:`, error.message);
        return { success: false, error: error.message };
    }
}
