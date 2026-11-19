import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbChat } from "@/lib/prisma-chat";
import { prismadb } from "@/lib/prisma";
const db: any = prismadbChat;
import { getAiSdkModel, isReasoningModel, logAiUsage } from "@/lib/varuni";
import { streamText, tool, convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { retrieveRelevantFacts } from "@/lib/vector-search";
import { systemLogger } from "@/lib/logger";
import { checkTeamQuota } from "@/lib/quota-service";
import { assertSafeExternalUrl, safeFetch } from "@/lib/security/ssrf-guard";

// ═══════════════════════════════════════════════════════════════════
// CRM Query Tools — Let Varuni directly query team-scoped CRM data
// ═══════════════════════════════════════════════════════════════════

function buildCrmTools(teamId: string, userId: string) {
    return {
        query_leads: tool({
            description: "Search and filter CRM leads. Returns up to 25 leads matching the criteria. Use this to answer questions about lead counts, statuses, pipeline stages, and outreach progress.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Free text search across name, email, company"),
                status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "LOST"]).optional().describe("Lead status filter"),
                pipeline_stage: z.enum(["Identify", "Engage_AI", "Engage_Human", "Offering", "Finalizing", "Closed"]).optional().describe("Pipeline stage filter"),
                outreach_status: z.enum(["IDLE", "PENDING", "SENT", "OPENED", "MEETING_LINK_CLICKED", "MEETING_BOOKED", "CLOSED"]).optional().describe("Outreach status filter"),
                assigned_to: z.string().optional().describe("User ID of the lead owner"),
                limit: z.number().min(1).max(50).optional().describe("Max results (default 25)"),
            }),
            execute: async ({ search, status, pipeline_stage, outreach_status, assigned_to, limit }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (pipeline_stage) where.pipeline_stage = pipeline_stage;
                if (outreach_status) where.outreach_status = outreach_status;
                if (assigned_to) where.assigned_to = assigned_to;
                if (search) {
                    where.OR = [
                        { firstName: { contains: search, mode: "insensitive" } },
                        { lastName: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                        { company: { contains: search, mode: "insensitive" } },
                    ];
                }
                const leads = await prismadb.crm_Leads.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, firstName: true, lastName: true, email: true, company: true,
                        status: true, pipeline_stage: true, outreach_status: true, jobTitle: true,
                        lead_source: true, createdAt: true, assigned_to: true,
                    }
                });
                const total = await prismadb.crm_Leads.count({ where: { team_id: teamId, ...(status ? { status } : {}), ...(pipeline_stage ? { pipeline_stage } : {}) } });
                return { results: leads, count: leads.length, totalMatching: total };
            },
        }),

        query_lead_pools: tool({
            description: "Search and list CRM Lead Pools (lists of leads used for targeting and outreach). Returns up to 25 active lead pools.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Free text search across pool name and description"),
                status: z.string().optional().describe("Status filter, typically ACTIVE")
            }),
            execute: async ({ search, status }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (search) {
                    where.OR = [
                        { name: { contains: search, mode: "insensitive" } },
                        { description: { contains: search, mode: "insensitive" } },
                    ];
                }
                const pools = await prismadb.crm_Lead_Pools.findMany({
                    where,
                    take: 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, name: true, description: true, status: true, createdAt: true,
                        _count: { select: { candidates: true, lead_maps: true } }
                    }
                });
                
                return { 
                    results: pools.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        description: p.description,
                        status: p.status,
                        totalLeads: (p._count?.candidates || 0) + (p._count?.lead_maps || 0)
                    })), 
                    count: pools.length 
                };
            },
        }),

        query_accounts: tool({
            description: "Search CRM accounts (companies/organizations). Returns up to 25 accounts matching the criteria. Use exact_name for pulling a specific account.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by company name, email, or industry"),
                exact_name: z.string().optional().describe("Search for an exact company name"),
                status: z.enum(["Active", "Inactive"]).optional(),
                type: z.string().optional().describe("Account type: Customer, Partner, Vendor, Prospect"),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, exact_name, status, type, limit }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (type) where.type = type;
                if (exact_name) {
                    where.name = exact_name;
                } else if (search) {
                    where.OR = [
                        { name: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                    ];
                }
                const accounts = await prismadb.crm_Accounts.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, name: true, email: true, website: true,
                        annual_revenue: true, employees: true,
                        type: true, status: true, billing_city: true, billing_country: true,
                        billing_state: true, createdAt: true, office_phone: true,
                    }
                });
                const total = await prismadb.crm_Accounts.count({ where: { team_id: teamId } });
                return { results: accounts, count: accounts.length, totalAccounts: total };
            },
        }),

        query_contacts: tool({
            description: "Search CRM contacts (individuals linked to accounts). Returns up to 25 contacts.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by name, email, or position"),
                active: z.boolean().optional().describe("Filter by active status (true/false)"),
                account_id: z.string().optional().describe("Filter by account ObjectId to get contacts linked to a specific company"),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, active, account_id, limit }: any) => {
                const where: any = { team_id: teamId };
                if (active !== undefined) where.status = active;
                if (account_id) where.accountsIDs = account_id;
                if (search) {
                    where.OR = [
                        { first_name: { contains: search, mode: "insensitive" } },
                        { last_name: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                        { position: { contains: search, mode: "insensitive" } },
                    ];
                }
                const contacts = await prismadb.crm_Contacts.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { last_activity: "desc" },
                    select: {
                        id: true, first_name: true, last_name: true, email: true,
                        position: true, mobile_phone: true, office_phone: true,
                        status: true, type: true, created_on: true,
                        assigned_accounts: { select: { name: true } },
                    }
                });
                const total = await prismadb.crm_Contacts.count({ where: { team_id: teamId } });
                return { results: contacts, count: contacts.length, totalContacts: total };
            },
        }),

        query_opportunities: tool({
            description: "Search CRM opportunities (deals). Returns up to 25 deals with stage, budget, and status info.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by deal name"),
                status: z.enum(["ACTIVE", "INACTIVE", "PENDING", "CLOSED"]).optional(),
                min_budget: z.number().optional().describe("Minimum budget filter"),
                max_budget: z.number().optional().describe("Maximum budget filter"),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, status, min_budget, max_budget, limit }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (search) where.name = { contains: search, mode: "insensitive" };
                if (min_budget !== undefined || max_budget !== undefined) {
                    where.budget = {};
                    if (min_budget !== undefined) where.budget.gte = min_budget;
                    if (max_budget !== undefined) where.budget.lte = max_budget;
                }
                const opps = await prismadb.crm_Opportunities.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, name: true, description: true, budget: true,
                        expected_revenue: true, currency: true, close_date: true,
                        status: true, next_step: true, createdAt: true,
                        assigned_sales_stage: { select: { name: true, probability: true } },
                        assigned_to_user: { select: { name: true } },
                    }
                });
                const total = await prismadb.crm_Opportunities.count({ where: { team_id: teamId } });
                return { results: opps, count: opps.length, totalDeals: total };
            },
        }),

        get_pipeline_stats: tool({
            description: "Get a summary of the sales pipeline: lead counts per stage, deal counts per status, total revenue, team size, and other KPIs. Use this for dashboard-style questions.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                timeframe: z.enum(["all_time", "this_month", "this_quarter", "this_year"]).describe("Filter stats by time frame. Note: currently returns all-time stats regardless of this parameter. Tell the user you are showing all-time stats.")
            }),
            execute: async ({ timeframe }: any) => {
                const [leadsByStage, leadsByStatus, dealsByStatus, totalLeads, totalDeals, totalAccounts, totalContacts] = await Promise.all([
                    prismadb.crm_Leads.groupBy({ by: ["pipeline_stage"], where: { team_id: teamId }, _count: true }),
                    prismadb.crm_Leads.groupBy({ by: ["status"], where: { team_id: teamId }, _count: true }),
                    prismadb.crm_Opportunities.groupBy({ by: ["status"], where: { team_id: teamId }, _count: true, _sum: { budget: true } }),
                    prismadb.crm_Leads.count({ where: { team_id: teamId } }),
                    prismadb.crm_Opportunities.count({ where: { team_id: teamId } }),
                    prismadb.crm_Accounts.count({ where: { team_id: teamId } }),
                    prismadb.crm_Contacts.count({ where: { team_id: teamId } }),
                ]);

                return {
                    leadsByPipelineStage: leadsByStage.map((g: any) => ({ stage: g.pipeline_stage, count: g._count })),
                    leadsByStatus: leadsByStatus.map((g: any) => ({ status: g.status, count: g._count })),
                    dealsByStatus: dealsByStatus.map((g: any) => ({ status: g.status, count: g._count, totalBudget: g._sum?.budget || 0 })),
                    totals: { leads: totalLeads, deals: totalDeals, accounts: totalAccounts, contacts: totalContacts },
                };
            },
        }),

        get_recent_activity: tool({
            description: "Get recent CRM activity: latest lead activities, newly created leads, and recent deal updates. Use this to answer 'what happened recently' questions.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                days: z.number().min(1).max(90).describe("Number of days to look back"),
                limit: z.number().min(1).max(50).optional().describe("Max results per category (default 10)"),
            }),
            execute: async ({ days, limit }: any) => {
                const since = new Date();
                since.setDate(since.getDate() - (days || 7));
                const take = limit || 10;

                const [recentLeads, recentDeals, recentActivities] = await Promise.all([
                    prismadb.crm_Leads.findMany({
                        where: { team_id: teamId, createdAt: { gte: since } },
                        take,
                        orderBy: { createdAt: "desc" },
                        select: { id: true, firstName: true, lastName: true, company: true, status: true, pipeline_stage: true, createdAt: true },
                    }),
                    prismadb.crm_Opportunities.findMany({
                        where: { team_id: teamId, updatedAt: { gte: since } },
                        take,
                        orderBy: { updatedAt: "desc" },
                        select: { id: true, name: true, status: true, budget: true, updatedAt: true, assigned_sales_stage: { select: { name: true } } },
                    }),
                    prismadb.crm_Lead_Activities.findMany({
                        where: { 
                            createdAt: { gte: since },
                            assigned_user: { team_id: teamId }
                        },
                        take,
                        orderBy: { createdAt: "desc" },
                        select: { id: true, type: true, subject: true, channel: true, direction: true, createdAt: true },
                    }),
                ]);

                return {
                    newLeads: recentLeads,
                    updatedDeals: recentDeals,
                    activities: recentActivities,
                    period: `Last ${days || 7} days`,
                };
            },
        }),

        searchCRMKnowledge: tool({
            description: "Search the deep Synthesis Layer memory for insights, facts, and context regarding a specific Account or Lead based on their historical actions, tasks, emails, sms, invoices, or subscriptions.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                entityName: z.string().describe("The exact or partial name of the Account (e.g., 'Acme Corp') or Lead (e.g., 'John Doe')"),
                query: z.string().describe("The specific question or topic to extract from memory (e.g., 'recent SMS replies', 'billing issues')"),
            }),
            execute: async ({ entityName, query }: any): Promise<any> => {
                try {
                    if (!teamId) {
                        return { success: false, reason: "Team context is required to search CRM knowledge." };
                    }
                    const targetEntity = entityName.split(' ')[0]; // Basic tokenization
                    // 1. Resolve Entity Context Node scoped strictly to caller's teamId
                    const contextNode = await prismadb.contextNode.findFirst({
                        where: {
                            AND: [
                                {
                                    OR: [
                                        { account: { team_id: teamId } },
                                        { lead: { team_id: teamId } }
                                    ]
                                },
                                {
                                    OR: [
                                        { account: { name: { contains: targetEntity, mode: 'insensitive' } } },
                                        { lead: { lastName: { contains: targetEntity, mode: 'insensitive' } } },
                                        { lead: { firstName: { contains: targetEntity, mode: 'insensitive' } } },
                                        { lead: { company: { contains: targetEntity, mode: 'insensitive' } } }
                                    ]
                                }
                            ]
                        },
                        include: { account: true, lead: true }
                    });

                    if (!contextNode) return { success: false, reason: `No memory node found for '${entityName}'` };

                    // 2. Compute Embedding targeting 'text-embedding-3-small'
                    let embedding: number[] = [];
                    if (process.env.OPENAI_API_KEY) {
                        const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ input: query, model: "text-embedding-3-small" })
                        });
                        const embedData = await embedRes.json();
                        if (embedData?.data?.[0]?.embedding) {
                            embedding = embedData.data[0].embedding;
                        }
                    }

                    if (!embedding.length) return { success: false, reason: "Math matrix generation failed (API Key missing)." };

                    // 3. Retrieve scored facts mathematically in Node.js
                    const facts = await retrieveRelevantFacts({
                        contextNodeId: contextNode.id,
                        queryEmbedding: embedding,
                        topK: 10,
                        minScore: 0.30
                    });

                    return {
                        entity: contextNode.account?.name || `${contextNode.lead?.firstName} ${contextNode.lead?.lastName}`,
                        lifecycleStatus: contextNode.lifecycleStatus,
                        intentLevel: contextNode.intentLevel,
                        sentimentScore: contextNode.sentimentScore,
                        relevantFacts: facts
                    };
                } catch (e) {
                    systemLogger.error("[KnowledgeToolError]", e);
                    return { success: false, reason: "Internal error retrieving memory." };
                }
            }
        }),

        // ═══════════════════════════════════════════════════════════════
        // TASKS
        // ═══════════════════════════════════════════════════════════════
        query_tasks: tool({
            description: "Search and list CRM tasks. Returns tasks with their status, priority, due date, and assignee. Use this for questions about open tasks, overdue items, or workload.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by task title or content"),
                status: z.enum(["ACTIVE", "PENDING", "COMPLETE"]).optional().describe("Task status filter"),
                priority: z.string().optional().describe("Priority filter: High, Medium, Low, Critical"),
                assigned_to: z.string().optional().describe("User ID of task assignee"),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, status, priority, assigned_to, limit }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.taskStatus = status;
                if (priority) where.priority = priority;
                if (assigned_to) where.user = assigned_to;
                if (search) {
                    where.OR = [
                        { title: { contains: search, mode: "insensitive" } },
                        { content: { contains: search, mode: "insensitive" } },
                    ];
                }
                const tasks = await prismadb.tasks.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, title: true, content: true, priority: true, taskStatus: true,
                        dueDateAt: true, createdAt: true,
                        assigned_user: { select: { name: true, email: true } },
                    }
                });
                const total = await prismadb.tasks.count({ where: { team_id: teamId } });
                const overdue = await prismadb.tasks.count({ where: { team_id: teamId, taskStatus: "ACTIVE", dueDateAt: { lt: new Date() } } });
                return { results: tasks, count: tasks.length, totalTasks: total, overdueTasks: overdue };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // SUPPORT CASES
        // ═══════════════════════════════════════════════════════════════
        query_cases: tool({
            description: "Search and list support cases (customer service tickets). Returns cases with status, priority, SLA info, and linked account/contact.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by case subject or description"),
                status: z.enum(["NEW", "OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER", "ESCALATED", "RESOLVED", "CLOSED"]).optional(),
                priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, status, priority, limit }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (priority) where.priority = priority;
                if (search) {
                    where.OR = [
                        { subject: { contains: search, mode: "insensitive" } },
                        { description: { contains: search, mode: "insensitive" } },
                        { case_number: { contains: search, mode: "insensitive" } },
                    ];
                }
                const cases = await prismadb.crm_Cases.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, case_number: true, subject: true, status: true, priority: true,
                        origin: true, type: true, sla_breached: true, escalation_level: true,
                        createdAt: true, closedAt: true,
                        account: { select: { name: true } },
                        contact: { select: { first_name: true, last_name: true } },
                        assigned_user: { select: { name: true } },
                    }
                });
                const total = await prismadb.crm_Cases.count({ where: { team_id: teamId } });
                const openCases = await prismadb.crm_Cases.count({ where: { team_id: teamId, status: { not: "CLOSED" } } });
                return { results: cases, count: cases.length, totalCases: total, openCases };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // EMAILS
        // ═══════════════════════════════════════════════════════════════
        query_emails: tool({
            description: "Search synced CRM emails (Gmail/Outlook). Returns email metadata including subject, sender, recipient, and linked lead/account. Use this for email activity questions.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by subject or sender email"),
                is_inbound: z.boolean().optional().describe("Filter by direction: true=received, false=sent"),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, is_inbound, limit }: any) => {
                const where: any = { team_id: teamId };
                if (is_inbound !== undefined) where.is_inbound = is_inbound;
                if (search) {
                    where.OR = [
                        { subject: { contains: search, mode: "insensitive" } },
                        { from_email: { contains: search, mode: "insensitive" } },
                        { from_name: { contains: search, mode: "insensitive" } },
                    ];
                }
                const emails = await prismadb.crm_Emails.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { date: "desc" },
                    select: {
                        id: true, subject: true, from_email: true, from_name: true,
                        is_inbound: true, is_read: true, has_attachments: true, date: true,
                        snippet: true, provider: true,
                    }
                });
                const total = await prismadb.crm_Emails.count({ where: { team_id: teamId } });
                return { results: emails, count: emails.length, totalEmails: total };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // OUTREACH CAMPAIGNS
        // ═══════════════════════════════════════════════════════════════
        query_outreach_campaigns: tool({
            description: "List outreach campaigns with their performance stats (emails sent, opened, replied, meetings booked). Use for questions about campaign performance or outreach status.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by campaign name"),
                status: z.enum(["DRAFT", "PENDING_APPROVAL", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"]).optional(),
                limit: z.number().min(1).max(25).optional(),
            }),
            execute: async ({ search, status, limit }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (search) where.name = { contains: search, mode: "insensitive" };
                const campaigns = await prismadb.crm_Outreach_Campaigns.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, name: true, description: true, status: true, channels: true,
                        total_leads: true, emails_sent: true, emails_opened: true, emails_replied: true,
                        sms_sent: true, meetings_booked: true, calls_initiated: true,
                        createdAt: true, launchedAt: true, completedAt: true,
                        assigned_pool: { select: { name: true } },
                    }
                });
                const total = await prismadb.crm_Outreach_Campaigns.count({ where: { team_id: teamId } });
                return { results: campaigns, count: campaigns.length, totalCampaigns: total };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // PRODUCTS
        // ═══════════════════════════════════════════════════════════════
        query_products: tool({
            description: "Search the product catalog. Returns products with pricing, stock, and category info.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by product name, SKU, or category"),
                active: z.boolean().optional().describe("Filter by active status"),
                category: z.string().optional().describe("Filter by category"),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, active, category, limit }: any) => {
                const where: any = { team_id: teamId };
                if (active !== undefined) where.active = active;
                if (category) where.category = { contains: category, mode: "insensitive" };
                if (search) {
                    where.OR = [
                        { name: { contains: search, mode: "insensitive" } },
                        { sku: { contains: search, mode: "insensitive" } },
                        { description: { contains: search, mode: "insensitive" } },
                    ];
                }
                const products = await prismadb.crm_Products.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, name: true, sku: true, description: true, price: true,
                        costPrice: true, category: true, stock: true, active: true,
                        isSubscription: true, currency: true,
                    }
                });
                const total = await prismadb.crm_Products.count({ where: { team_id: teamId } });
                return { results: products, count: products.length, totalProducts: total };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // QUOTES
        // ═══════════════════════════════════════════════════════════════
        query_quotes: tool({
            description: "Search CRM quotes/proposals. Returns quotes with status, total amount, linked account, and line item count.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by quote title or number"),
                status: z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).optional(),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, status, limit }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (search) {
                    where.OR = [
                        { title: { contains: search, mode: "insensitive" } },
                        { quoteNumber: { contains: search, mode: "insensitive" } },
                    ];
                }
                const quotes = await prismadb.crm_Quotes.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, title: true, quoteNumber: true, status: true,
                        totalAmount: true, expirationDate: true, notes: true, createdAt: true,
                        account: { select: { name: true } },
                        contact: { select: { first_name: true, last_name: true } },
                        _count: { select: { items: true } },
                    }
                });
                const total = await prismadb.crm_Quotes.count({ where: { team_id: teamId } });
                return { results: quotes.map((q: any) => ({ ...q, lineItemCount: q._count?.items || 0 })), count: quotes.length, totalQuotes: total };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // INVOICES
        // ═══════════════════════════════════════════════════════════════
        query_invoices: tool({
            description: "Search invoices (accounts payable/receivable documents). Returns invoices with amounts, status, partner info, and payment status.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by invoice number, partner name, or description"),
                payment_status: z.enum(["UNPAID", "PAID", "OVERDUE", "PARTIAL"]).optional(),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, payment_status, limit }: any) => {
                const where: any = { team_id: teamId };
                if (payment_status) where.payment_status = payment_status;
                if (search) {
                    where.OR = [
                        { invoice_number: { contains: search, mode: "insensitive" } },
                        { partner: { contains: search, mode: "insensitive" } },
                        { description: { contains: search, mode: "insensitive" } },
                    ];
                }
                const invoices = await prismadb.invoices.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { date_created: "desc" },
                    select: {
                        id: true, invoice_number: true, invoice_amount: true, invoice_currency: true,
                        partner: true, description: true, status: true, payment_status: true,
                        date_created: true, date_due: true, invoice_type: true,
                        accounts: { select: { name: true } },
                    }
                });
                const total = await prismadb.invoices.count({ where: { team_id: teamId } });
                return { results: invoices, count: invoices.length, totalInvoices: total };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // SUBSCRIPTIONS
        // ═══════════════════════════════════════════════════════════════
        query_subscriptions: tool({
            description: "List subscription billing records. Returns subscription plan, amount, billing cycle, status, and next billing date.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                status: z.string().optional().describe("Status filter: ACTIVE, PAUSED, CANCELLED, OVERDUE, SUSPENDED"),
            }),
            execute: async ({ status }: any) => {
                const where: any = { tenant_id: teamId };
                if (status) where.status = status;
                const subs = await prismadb.crm_Subscriptions.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, plan_name: true, amount: true, currency: true,
                        interval: true, status: true, next_billing_date: true,
                        payment_provider: true, customer_email: true,
                        last_charge_date: true, last_charge_status: true,
                        account: { select: { name: true } },
                    }
                });
                return { results: subs, count: subs.length };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // CONTRACTS
        // ═══════════════════════════════════════════════════════════════
        query_contracts: tool({
            description: "Search CRM contracts. Returns contracts with value, status, dates, and linked account.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by contract title"),
                status: z.enum(["NOTSTARTED", "INPROGRESS", "SIGNED"]).optional(),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, status, limit }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (search) where.title = { contains: search, mode: "insensitive" };
                const contracts = await prismadb.crm_Contracts.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, title: true, value: true, status: true, type: true,
                        startDate: true, endDate: true, renewalReminderDate: true,
                        customerSignedDate: true, companySignedDate: true, createdAt: true,
                        assigned_account: { select: { name: true } },
                        assigned_to_user: { select: { name: true } },
                    }
                });
                const total = await prismadb.crm_Contracts.count({ where: { team_id: teamId } });
                return { results: contracts, count: contracts.length, totalContracts: total };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // DEAL ROOMS
        // ═══════════════════════════════════════════════════════════════
        query_deal_rooms: tool({
            description: "List deal rooms (digital sales rooms for closing deals). Returns rooms with engagement scores, view counts, and linked contract info.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                active_only: z.boolean().optional().describe("Only return active deal rooms"),
            }),
            execute: async ({ active_only }: any) => {
                const where: any = { contract: { team_id: teamId } };
                if (active_only) where.is_active = true;
                // Deal rooms are linked to contracts which have team_id
                const rooms = await prismadb.crm_DealRooms.findMany({
                    where,
                    take: 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, slug: true, is_active: true, welcome_message: true,
                        total_views: true, unique_visitors: true, engagement_score: true,
                        last_viewed_at: true, interactive_pricing: true, createdAt: true,
                        contract: { select: { title: true, value: true, status: true, assigned_account: { select: { name: true } } } },
                        _count: { select: { activities: true } },
                    }
                });
                return { results: rooms.map((r: any) => ({ ...r, activityCount: r._count?.activities || 0 })), count: rooms.length };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // DOCUMENTS
        // ═══════════════════════════════════════════════════════════════
        query_documents: tool({
            description: "Search the document library (files, contracts, invoices, receipts). Returns documents with type, owner, and linked entities.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by document name or description"),
                system_type: z.enum(["INVOICE", "RECEIPT", "CONTRACT", "OFFER", "OTHER"]).optional(),
                limit: z.number().min(1).max(50).optional(),
            }),
            execute: async ({ search, system_type, limit }: any) => {
                const where: any = { team_id: teamId };
                if (system_type) where.document_system_type = system_type;
                if (search) {
                    where.OR = [
                        { document_name: { contains: search, mode: "insensitive" } },
                        { description: { contains: search, mode: "insensitive" } },
                    ];
                }
                const docs = await prismadb.documents.findMany({
                    where,
                    take: limit || 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, document_name: true, description: true,
                        document_file_mimeType: true, document_system_type: true,
                        status: true, size: true, createdAt: true,
                        created_by: { select: { name: true } },
                    }
                });
                const total = await prismadb.documents.count({ where: { team_id: teamId } });
                return { results: docs, count: docs.length, totalDocuments: total };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // TEAM MEMBERS
        // ═══════════════════════════════════════════════════════════════
        query_team_members: tool({
            description: "List team members with their roles and status. Use for questions about team structure, who is on the team, or role assignments.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by name or email"),
            }),
            execute: async ({ search }: any) => {
                const where: any = { team_id: teamId };
                if (search) {
                    where.OR = [
                        { name: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                    ];
                }
                const members = await prismadb.users.findMany({
                    where,
                    orderBy: { created_on: "desc" },
                    select: {
                        id: true, name: true, email: true, team_role: true,
                        userStatus: true, lastLoginAt: true, created_on: true,
                    }
                });
                return { results: members, count: members.length };
            },
        }),

        query_forms: tool({
            description: "List lead capture forms, surveys, and onboarding forms with their submission stats and field configurations.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by form name"),
                status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
            }),
            execute: async ({ search, status }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (search) {
                    where.name = { contains: search, mode: "insensitive" };
                }
                const forms = await prismadb.form.findMany({
                    where,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, name: true, description: true, slug: true, status: true,
                        visibility: true, submission_behavior: true,
                        submission_count: true, view_count: true, createdAt: true,
                        fields: {
                            select: { name: true, label: true, field_type: true, is_required: true }
                        }
                    }
                });
                return { results: forms, count: forms.length };
            },
        }),

        // ═══════════════════════════════════════════════════════════════
        // PROJECTS & KNOWLEDGE
        // ═══════════════════════════════════════════════════════════════
        query_projects: tool({
            description: "Search and list Projects (Boards). Returns active projects with their status, workflow, and objectives.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by project title or description"),
                status: z.enum(["DRAFT", "PLANNING", "ACTIVE", "REVIEW", "COMPLETED", "ARCHIVED", "ON_HOLD", "CANCELLED"]).optional(),
            }),
            execute: async ({ search, status }: any) => {
                const where: any = { team_id: teamId };
                if (status) where.status = status;
                if (search) {
                    where.OR = [
                        { title: { contains: search, mode: "insensitive" } },
                        { description: { contains: search, mode: "insensitive" } },
                    ];
                }
                const projects = await prismadb.boards.findMany({
                    where,
                    take: 25,
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true, title: true, description: true, status: true,
                        target_industries: true, target_titles: true, campaign_brief: true,
                        createdAt: true,
                    }
                });
                return { results: projects, count: projects.length };
            },
        }),

        query_support_articles: tool({
            description: "Search the Knowledge Base (Help Hub) articles. Use this to help customers or agents find support documentation.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
                search: z.string().optional().describe("Search by article title or content"),
            }),
            execute: async ({ search }: any) => {
                const where: any = { team_id: teamId };
                if (search) {
                    where.OR = [
                        { title: { contains: search, mode: "insensitive" } },
                        { summary: { contains: search, mode: "insensitive" } },
                    ];
                }
                const articles = await prismadb.knowledgeArticle.findMany({
                    where,
                    take: 15,
                    orderBy: { view_count: "desc" },
                    select: {
                        id: true, title: true, summary: true, slug: true, status: true,
                        view_count: true, is_internal: true,
                    }
                });
                return { results: articles, count: articles.length };
            },
        }),

        query_scraper_jobs: tool({
            description: "List Lead Generation Scraper Jobs (Agentic Scrapers). Returns status, performance logs, and lead capture templates.",
            inputSchema: z.object({
                intent: z.string().describe("Reasoning for calling this tool"),
            }),
            execute: async () => {
                const jobs = await prismadb.crm_Lead_Gen_Jobs.findMany({
                    where: { assigned_pool: { team_id: teamId } },
                    take: 20,
                    orderBy: { startedAt: "desc" },
                    select: {
                        id: true, status: true, startedAt: true, finishedAt: true,
                        counters: true, providers: true,
                        assigned_pool: { select: { name: true } },
                    }
                });
                return { results: jobs, count: jobs.length };
            },
        }),
    };
}


/**
 * Build the CRM Chief Agent system prompt with current time and comprehensive ontology
 */
interface CrmSystemContext {
    timezone?: string;
    teamName?: string;
    userRole?: string;
    userName?: string;
    userEmail?: string;
    planTier?: string;
    planFeatures?: string[];
}

function buildCrmAgentSystemPrompt(context: CrmSystemContext): string {
    const { timezone, teamName, userRole, userName, userEmail, planTier, planFeatures } = context;
    // Get current time in user's timezone (default to UTC if not specified)
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const now = new Date();
    const formattedTime = now.toLocaleString("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    });

    const featuresList = planFeatures && planFeatures.length > 0 ? planFeatures.join(", ") : "Standard CRM Features";

    return `You are Varuni, the Chief CRM Agent for ${teamName ? teamName : "Basalt CRM"}—an intelligent, autonomous AI assistant purpose-built to help sales teams, account managers, and business operators manage their customer relationships, sales pipelines, and business operations with maximum efficiency.

## CURRENT CONTEXT & PERFECT KNOWLEDGE
- **Current Time**: ${formattedTime}
- **Timezone**: ${tz}
- **Organization**: ${teamName || "Basalt CRM"}
- **Active Subscription Tier**: ${planTier || "Standard"}
- **Available Plan Modules**: ${featuresList}

### YOUR CURRENT USER
You are speaking strictly with the following user. Use this information to personalize your responses and address them naturally:
- **Name**: ${userName || "User"}
- **Your Email**: ${userEmail || "Unknown"}
- **Your Team**: ${teamName}
- **Your Role**: ${userRole || "USER"}

## CORE IDENTITY & MISSION
You are a proactive, knowledgeable, and action-oriented assistant. Your mission is to:
1. Help users manage and grow their customer relationships
2. Streamline sales processes and pipeline management
3. Provide actionable insights from CRM data
4. Automate repetitive tasks and workflows
5. Ensure data integrity and best practices across all CRM operations

## CRM ONTOLOGY & DOMAIN KNOWLEDGE

### PRIMARY ENTITIES

#### **Accounts** (crm_Accounts)
Business organizations or companies in the CRM. Key attributes:
- **Identity**: name, company_id, VAT, website, email
- **Contact Info**: office_phone, fax
- **Addresses**: billing (street, city, state, postal_code, country) and shipping addresses
- **Business Info**: industry (linked to Industry_Type), annual_revenue, employees, type (Customer/Partner/Vendor/Prospect)
- **Status**: Active/Inactive
- **Ownership**: assigned_to (user), team_id
- **Relationships**: has many Contacts, Leads, Opportunities, Contracts, Invoices, Documents, Tasks

#### **Contacts** (crm_Contacts)
Individual people associated with accounts. Key attributes:
- **Identity**: first_name, last_name, email, personal_email, birthday
- **Professional**: position, office_phone, mobile_phone
- **Social**: twitter, facebook, linkedin, skype, instagram, youtube, tiktok
- **Status**: active/inactive, email_unsubscribed
- **Tags & Notes**: custom categorization
- **Ownership**: assigned_to, created_by, team_id
- **Relationships**: belongs to Account, linked to Opportunities

#### **Leads** (crm_Leads)
Potential customers in early sales stages. Key attributes:
- **Identity**: firstName, lastName, company, jobTitle, email, phone
- **Source**: lead_source, refered_by, campaign
- **Status**: NEW, CONTACTED, QUALIFIED, LOST
- **Type**: DEMO (default)
- **Pipeline Stage**: Identify → Engage_AI → Engage_Human → Offering → Finalizing → Closed
- **Outreach Tracking**: outreach_status (IDLE/PENDING/SENT/OPENED/MEETING_LINK_CLICKED/MEETING_BOOKED/CLOSED), outreach_sent_at, outreach_opened_at, meeting_link, meeting_booked_at
- **Multi-Channel**: outreach_transport, sms_status, call_status, phone_verified
- **Ownership**: assigned_to, team_id, project (Board)

#### **Opportunities** (crm_Opportunities)
Sales deals being actively pursued. Key attributes:
- **Identity**: name, description
- **Financials**: budget, expected_revenue, currency
- **Timeline**: close_date, next_step
- **Stage**: sales_stage (linked to Sales_Stages with probability)
- **Type**: linked to Opportunities_Type
- **Status**: ACTIVE, INACTIVE, PENDING, CLOSED
- **Ownership**: assigned_to, created_by, team_id
- **Relationships**: linked to Account, Campaign, Contacts, Documents

#### **Contracts** (crm_Contracts)
Legal agreements with customers. Key attributes:
- **Identity**: title, description, type
- **Value**: monetary value
- **Dates**: startDate, endDate, renewalReminderDate, customerSignedDate, companySignedDate
- **Status**: NOTSTARTED, INPROGRESS, SIGNED
- **Relationships**: linked to Account

#### **Invoices** (Invoices)
Financial documents for billing. Key attributes:
- **Identity**: invoice_number, variable_symbol, order_number
- **Dates**: date_created, date_received, date_due, date_tax
- **Financial**: invoice_amount, invoice_currency, invoice_items (JSON)
- **Partner Info**: partner name, addresses, VAT/TAX numbers, bank details
- **Document**: invoice_file_url, invoice_file_mimeType
- **Integration**: rossum_status, rossum_annotation_id (AI document processing)
- **Status**: linked to invoice_States

### SALES PIPELINE ENTITIES

#### **Campaigns** (crm_campaigns)
Marketing campaigns that generate leads/opportunities. Attributes: name, description, status.

#### **Sales Stages** (crm_Opportunities_Sales_Stages)
Configurable pipeline stages with: name, probability (%), order.

#### **Opportunity Types** (crm_Opportunities_Type)
Categories of opportunities: name, order.

### LEAD GENERATION ENTITIES

#### **Lead Pools** (crm_Lead_Pools)
Collections of leads with ICP (Ideal Customer Profile) configuration. Used for organizing and processing leads.

#### **Lead Gen Jobs** (crm_Lead_Gen_Jobs)
Automated lead generation tasks with: status (QUEUED/RUNNING/PAUSED/STOPPED/SUCCESS/FAILED), providers, queryTemplates, counters, logs.

#### **Lead Candidates** (crm_Lead_Candidates)
Pre-qualified potential leads with: domain, companyName, description, industry, techStack, score, status (NEW/APPROVED/REJECTED/CONVERTED).

#### **Contact Candidates** (crm_Contact_Candidates)
Contact information discovered during lead gen: fullName, title, email, emailStatus (VALID/RISKY/INVALID/CATCH_ALL/UNKNOWN), phone, linkedinUrl, confidence.

#### **Global Companies/Persons** (crm_Global_Companies, crm_Global_Persons)
Shared database of companies and individuals for deduplication across the platform.

### PROJECT MANAGEMENT ENTITIES

#### **Boards** (Boards)
Project boards for task management. Attributes: title, description, icon, visibility, branding (logo, colors), watchers.

#### **Sections** (Sections)
Columns within boards: title, position.

#### **Tasks** (Tasks)
Work items within sections: title, content, priority, dueDateAt, position, tags, taskStatus (ACTIVE/PENDING/COMPLETE), likes.

#### **Account Tasks** (crm_Accounts_Tasks)
Tasks specifically linked to CRM accounts with similar attributes to Tasks.

#### **Task Comments** (tasksComments)
Discussion on tasks: comment, createdAt, user.

### DOCUMENT MANAGEMENT

#### **Documents** (Documents)
Files attached to CRM records: document_name, document_file_url, mimeType, size, tags, document_system_type (INVOICE/RECEIPT/CONTRACT/OFFER/OTHER).

### USER & TEAM MANAGEMENT

#### **Users** (Users)
System users with: name, email, avatar, role (via roleId), userStatus (ACTIVE/INACTIVE/PENDING), userLanguage, is_admin, is_account_admin, team_id, team_role (OWNER/ADMIN/MEMBER).

User personalization: meeting_link, signature_html, resource_links, outreach_prompt_default, calendar preferences.

#### **Teams** (Team)
Multi-tenant organization units: name, slug, logo_url, owner_id, subscription_plan, status (ACTIVE/PENDING/SUSPENDED), plan_id.

#### **Roles** (Role)
Permission-based access control: name, permissions[], description.

#### **Plans** (Plan)
Subscription tiers: name, slug (FREE/TEAM/ENTERPRISE), price, max_users, max_storage, max_credits, billing_cycle, features[].

### AI & INTEGRATION ENTITIES

#### **Chat Sessions/Messages** (chat_Sessions, chat_Messages)
Conversation history with AI: title, isTemporary, messages with role/content/tokenUsage.

#### **AI Models** (AiModel)
Available AI models: name, modelId, provider (OPENAI/AZURE/ANTHROPIC/GOOGLE/GROK/DEEPSEEK/PERPLEXITY/MISTRAL), pricing.

#### **System/Team AI Config**
AI configuration at system and team level: provider, apiKey, modelId, useSystemKey.

#### **OpenAI Keys** (openAi_keys)
User-specific API keys: organization_id, api_key.

#### **Gmail Tokens** (gmail_Tokens)
Email integration: access_token, refresh_token, scope, expiry_date.

### CMS & PUBLIC CONTENT

#### **Blog Posts** (BlogPost): title, slug, content, excerpt, coverImage, category, author.
#### **Job Postings** (JobPosting): title, department, location, type, requirements.
#### **Doc Articles** (DocArticle): title, slug, category, content, videoUrl.

## WORKFLOW & PROCESS KNOWLEDGE

### Lead-to-Customer Journey
1. **Identify**: Lead discovered/created → NEW status
2. **Engage_AI**: Automated outreach via email/SMS/call
3. **Engage_Human**: Sales rep takes over qualified leads
4. **Offering**: Opportunity created, proposals sent
5. **Finalizing**: Contract negotiation, signatures
6. **Closed**: Deal won → Account created/updated

### Outreach Sequence
1. IDLE → PENDING (queued for send)
2. PENDING → SENT (message delivered)
3. SENT → OPENED (tracking pixel/link clicked)
4. OPENED → MEETING_LINK_CLICKED → MEETING_BOOKED
5. Any stage → CLOSED (complete or disqualified)

### Pipeline Management
- Opportunities progress through configurable Sales Stages
- Each stage has probability % for forecasting
- Expected revenue = budget × probability
- Track close_date for pipeline velocity

## COMMUNICATION GUIDELINES

1. **Be Proactive**: Anticipate user needs, suggest next actions
2. **Be Specific**: Reference entity names, IDs, dates when relevant
3. **Be Actionable**: Provide clear steps, not vague advice
4. **Be Data-Driven**: Base recommendations on CRM data patterns
5. **Respect Time**: The current time context matters for deadlines, follow-ups, scheduling
6. **Maintain Context**: Remember conversation history within the session
7. **Keep Initial Greetings Brief**: When the user just says "Hi", "Hey", or asks a very simple question, reply with a VERY short, conversational, and concise greeting.
8. **Minimal Verbosity**: Always be direct and to the point. Avoid corporate fluff, repetitive status checks, or over-explaining your purpose.
9. **ALWAYS EXPLAIN TOOL RESULTS IN TEXT**: After you call a tool, you MUST output markdown text narrating the results to the user. Do not assume the system will display the raw data. You must format the data in a readable conversational way so the user can see it.

## CAPABILITIES & TOOLS

### You CAN:
- Answer questions about CRM concepts, best practices, and workflows
- **DIRECTLY QUERY the CRM database** using your tools to get real-time data
- Search and filter leads, accounts, contacts, and opportunities
- Get pipeline statistics ... lead counts per stage, deal totals, revenue summaries
- View recent CRM activity (new leads, deal updates, activities)
- Suggest sales strategies and outreach approaches
- Guide users through CRM features and processes
- Provide templates for emails, proposals, and follow-ups
- Calculate pipeline metrics and forecasts
- Recommend next best actions based on real data

### AVAILABLE TOOLS:

**Core CRM Data:**
- **query_leads**: Search leads by name, email, status, pipeline stage, outreach status
- **query_lead_pools**: Search and list Lead Pools (segmentation lists) with lead counts
- **query_accounts**: Search accounts by name, industry, type, status
- **query_contacts**: Search contacts by name, email, position
- **query_opportunities**: Search deals by name, status, budget range

**Pipeline & Activity:**
- **get_pipeline_stats**: Get full pipeline summary with counts and revenue per stage
- **get_recent_activity**: Get recent lead/deal/activity changes (configurable days)

**Tasks & Workflow:**
- **query_tasks**: Search tasks by title, status, priority, assignee, overdue tracking

**Customer Support:**
- **query_cases**: Search support cases by status, priority, SLA breach info

**Communication:**
- **query_emails**: Search synced emails (Gmail/Outlook) by subject, sender, direction
- **query_outreach_campaigns**: List outreach campaigns with performance stats (sent, opened, replied, meetings booked)

**Products & Revenue:**
- **query_products**: Search product catalog by name, SKU, category, stock
- **query_quotes**: Search quotes/proposals by status, amount, linked account
- **query_invoices**: Search invoices by number, partner, payment status
- **query_subscriptions**: List subscription billing records with plan and billing cycle info
- **query_contracts**: Search contracts by status, value, linked account

**Collaboration & Documents:**
- **query_deal_rooms**: List deal rooms with engagement scores and visitor analytics
- **query_projects**: List enterprise Projects (Boards) with current status and objectives
- **query_documents**: Search document library by name, type (invoice/receipt/contract/offer)
- **query_forms**: List lead capture and onboarding forms with submission stats

**Team & Intelligence:**
- **query_team_members**: List team members with roles and status
- **searchCRMKnowledge**: Search deep Synthesis Layer memory for Account/Lead facts and history
- **query_scraper_jobs**: View Agentic Web Scraper jobs fetching new leads for pools
- **query_support_articles**: Search Help Hub for support tutorials, guides, and documentation

### STRICT ANTI-HALLUCINATION PROTOCOL
You are a deterministic data-retrieval agent. YOU MUST OBEY THE FOLLOWING:
1. **NEVER HALLUCINATE OR GUESS DATA.** If you do not have a specific tool to fetch the requested entity, you MUST explicitly state: "I do not have access to that module yet."
2. **NEVER MAKE UP PLACEHOLDERS.** If you execute a tool and it returns 0 results or an error, you MUST state: "No records found" or "I encountered an error." Do NOT generate fake examples to be helpful. 
3. **TOOL FIRST.** If a user asks for Opportunities, Leads, Contacts, etc., you MUST call the respective tool first before answering.
4. **READ ONLY.** If a question requires writing data (creating leads, updating records, sending emails), explain that you can only read data currently and guide them to perform the action in the CRM interface.`;
}

// Helper to extract content from either UIMessage (parts array) or ModelMessage (content string) format
function extractMessageContent(message: any): string {
    // If content is already a string, use it
    if (typeof message.content === 'string') {
        return message.content;
    }
    // AI SDK 5.x UIMessage format: extract text from parts array
    if (Array.isArray(message.parts)) {
        return message.parts.map((part: any) => {
            if (typeof part === 'string') return part;
            if (part.type === 'text' && typeof part.text === 'string') return part.text;
            if (typeof part.content === 'string') return part.content;
            return '';
        }).join('');
    }
    return '';
}

// POST /api/chat
// Handles streaming chat completions
export async function POST(req: Request) {
    const auth = await getServerSession(authOptions);
    if (!auth) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const payload = await req.json();
        console.log("[DEBUG_CHAT_PAYLOAD]", JSON.stringify(payload));
        // Retrieve sessionId from the body, falling back to 'id' (which is how AI SDK v6 natively sends the chat ID)
        const sessionId = payload.sessionId || payload.id;
        const { messages: incomingMessages, content, timezone } = payload;
        const parentId = payload.parentId || payload.data?.parentId;

        if (!sessionId) {
            return new NextResponse("Session ID is required", { status: 400 });
        }

        const chatSession = await db.chat_Sessions.findUnique({
            where: { id: sessionId },
        });

        if (!chatSession || chatSession.user !== auth.user.id) {
            return new NextResponse("Session Not Found", { status: 404 });
        }

        // Build conversation for the model
        // Handles both AI SDK 5.x UIMessage (parts array) and legacy ModelMessage (content string) formats
        let modelMessages: any[] = [];
        let lastUserContent = content;

        // Fetch team details for context
        let teamName = "Basalt CRM";
        let userRole = "MEMBER";
        let userName = auth.user.name || "User";
        let userEmail = auth.user.email || "Unknown";
        let planTier = "Unknown";
        let planFeatures: string[] = [];
        let userTeamId: string | null = null;

        try {
            const user = await prismadb.users.findUnique({
                where: { id: auth.user.id },
                include: { 
                    assigned_team: {
                        include: { assigned_plan: true }
                    } 
                }
            });
            if (user?.team_id) userTeamId = user.team_id;
            if (user?.assigned_team?.name) teamName = user.assigned_team.name;
            if (user?.team_role) userRole = user.team_role;
            if (user?.name) userName = user.name;
            if (user?.email) userEmail = user.email;
            
            if (user?.assigned_team?.assigned_plan) {
                planTier = user.assigned_team.assigned_plan.name || "Unknown";
                planFeatures = user.assigned_team.assigned_plan.features as string[] || [];
            } else if (user?.assigned_team?.plan_id) {
                // Fallback attempt to get plan tier
                planTier = String(user.assigned_team.plan_id).toUpperCase();
            }

            // Enforce AI token quota before processing
            if (user?.team_id) {
                const quota = await checkTeamQuota(user.team_id, "AI_TOKENS", auth!.user.id);
                if (!quota.allowed) {
                    return new NextResponse(
                        JSON.stringify({ error: quota.message || "AI token limit reached. Please top up your AI tokens." }),
                        { status: 429, headers: { "Content-Type": "application/json" } }
                    );
                }
            }
        } catch (e) {
            console.warn("Failed to fetch user context for chat", e);
        }

        // Build the CRM agent system prompt with timezone awareness
        const systemPrompt = buildCrmAgentSystemPrompt({
            timezone, 
            teamName, 
            userRole,
            userName,
            userEmail,
            planTier,
            planFeatures
        });

        if (incomingMessages && Array.isArray(incomingMessages)) {
            // Check if messages are in UIMessage format (have 'parts' array) vs legacy DB format (plain 'content' string)
            const hasUIMessageFormat = incomingMessages.some((m: any) => m.parts && Array.isArray(m.parts));
            
            if (hasUIMessageFormat) {
                // Normalize ALL messages to have parts arrays — some may be DB-loaded (content only)
                // while others are SDK-managed (parts array). convertToModelMessages requires parts on every message.
                const normalizedMessages = incomingMessages.map((m: any) => {
                    if (m.parts && Array.isArray(m.parts)) return m;
                    // Convert plain content string to UIMessage parts format
                    const text = typeof m.content === 'string' ? m.content : '';
                    return {
                        ...m,
                        parts: text ? [{ type: 'text', text }] : [],
                    };
                });

                // Use AI SDK v6 convertToModelMessages for proper UIMessage → ModelMessage conversion
                try {
                    const converted = await convertToModelMessages(normalizedMessages as UIMessage[]);
                    modelMessages = [
                        { role: "system" as const, content: systemPrompt },
                        ...converted,
                    ];
                } catch (convErr) {
                    systemLogger.warn("[CHAT_CONVERT_FALLBACK] convertToModelMessages failed, using manual conversion", convErr);
                    // Fall through to manual conversion below
                    const convertedMessages = incomingMessages
                        .filter((m: any) => m.role && (m.content || m.parts))
                        .map((m: any) => ({
                            role: m.role as "system" | "user" | "assistant",
                            content: extractMessageContent(m),
                        }))
                        .filter((m: any) => m.content);
                    modelMessages = [
                        { role: "system", content: systemPrompt },
                        ...convertedMessages,
                    ];
                }
            } else {
                // Legacy DB messages with plain content strings — use manual conversion directly
                const convertedMessages = incomingMessages
                    .filter((m: any) => m.role && (m.content || m.parts))
                    .map((m: any) => ({
                        role: m.role as "system" | "user" | "assistant",
                        content: extractMessageContent(m),
                    }))
                    .filter((m: any) => m.content);
                modelMessages = [
                    { role: "system", content: systemPrompt },
                    ...convertedMessages,
                ];
            }

            // Find the last user message content for DB persistence
            const lastUserMessage = [...incomingMessages].reverse().find((m: any) => m.role === "user");
            if (!lastUserContent && lastUserMessage) {
                lastUserContent = extractMessageContent(lastUserMessage);
            }
        } else if (content) {
            modelMessages = [
                { role: "system", content: systemPrompt },
                { role: "user", content },
            ];
        } else {
            return new NextResponse("No content or messages provided", { status: 400 });
        }

        // Ensure we have valid messages
        if (modelMessages.length === 0 || !lastUserContent) {
            return new NextResponse("No valid messages to process", { status: 400 });
        }

        // Create user message if the session is not temporary
        let userMessageId: string | null = null;
        const uploadedAttachments = payload.attachments || payload.data?.attachments || undefined;
        
        if (!chatSession.isTemporary && lastUserContent) {
            const userMessage = await db.chat_Messages.create({
                data: {
                    session: sessionId,
                    parent: parentId,
                    role: "user",
                    content: lastUserContent,
                    model: undefined,
                    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || undefined,
                    attachments: uploadedAttachments ? uploadedAttachments : undefined,
                },
            });
            userMessageId = userMessage.id;
            await db.chat_Sessions.update({
                where: { id: sessionId },
                data: { updatedAt: new Date() },
            });
        }

        // Merge attachments into the model payload so the AI actually sees them during streaming
        if (uploadedAttachments && Array.isArray(uploadedAttachments) && uploadedAttachments.length > 0) {
            const lastUserIdx = modelMessages.map((m: any) => m.role).lastIndexOf('user');
            if (lastUserIdx !== -1) {
                const targetMessage = modelMessages[lastUserIdx];
                const parts: any[] = [];
                
                if (Array.isArray(targetMessage.content)) {
                    parts.push(...targetMessage.content);
                } else if (typeof targetMessage.content === 'string' && targetMessage.content) {
                    parts.push({ type: 'text', text: targetMessage.content });
                }

                // Use a standard for loop to allow async resolution of presigned URLs
                for (let i = 0; i < uploadedAttachments.length; i++) {
                    const att = uploadedAttachments[i];
                    if (!att.url) continue;
                    
                    try {
                        let finalUrlString = att.url;
                        if (att.url.includes('s3.us-west-or.io.cloud.ovh.us')) {
                            // Extract and verify ownership of S3 key before presigning
                            const s3Key = decodeURIComponent(att.url.split('.us/')[1] || "").split("?")[0];
                            if (!s3Key || s3Key.includes("..") || s3Key.includes("\\") || !userTeamId) {
                                continue;
                            }
                            const ownedDoc = await prismadb.documents.findFirst({
                                where: { key: s3Key, team_id: userTeamId },
                                select: { id: true },
                            });
                            if (!ownedDoc) {
                                continue;
                            }
                            const { getBlobServiceClient } = await import("@/lib/s3-storage");
                            finalUrlString = await getBlobServiceClient().getPresignedUrl(s3Key, 3600);
                        } else {
                            await assertSafeExternalUrl(finalUrlString);
                        }
                        
                        const fileUrl = new URL(finalUrlString);
                        const mime = att.contentType || '';
                        const isDoc = mime.includes('pdf') || mime.includes('excel') || mime.includes('spreadsheet') || mime.includes('csv') || mime.includes('text') || mime.includes('word') || mime.includes('document');
                        
                        if (isDoc) {
                            try {
                                const docRes = await safeFetch(finalUrlString);
                                if (docRes.ok) {
                                    if (mime.includes('pdf')) {
                                        const arrayBuffer = await docRes.arrayBuffer();
                                        const pdfParse = (await import('pdf-parse')).default;
                                        const data = await pdfParse(Buffer.from(arrayBuffer));
                                        parts.push({ type: 'text', text: `[Attached PDF Document: ${att.name || 'document.pdf'}]\n\n${data.text.substring(0, 25000)}` });
                                    } else if (mime.includes('excel') || mime.includes('spreadsheet')) {
                                        const arrayBuffer = await docRes.arrayBuffer();
                                        const ExcelJS = await import('exceljs');
                                        const workbook = new ExcelJS.Workbook();
                                        await workbook.xlsx.load(Buffer.from(arrayBuffer) as any);
                                        let textOutput = '';
                                        workbook.eachSheet((worksheet) => {
                                            textOutput += `\n--- Sheet: ${worksheet.name} ---\n`;
                                            worksheet.eachRow((row) => {
                                                const rowValues = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values || {});
                                                textOutput += rowValues.join(' | ') + '\n';
                                            });
                                        });
                                        parts.push({ type: 'text', text: `[Attached Excel Document: ${att.name || 'spreadsheet.xlsx'}]\n\n${textOutput.substring(0, 25000)}` });
                                    } else if (mime.includes('word') || mime.includes('document')) {
                                        const arrayBuffer = await docRes.arrayBuffer();
                                        const mammoth = (await import('mammoth')).default;
                                        const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
                                        parts.push({ type: 'text', text: `[Attached Word Document: ${att.name || 'document.docx'}]\n\n${result.value.substring(0, 25000)}` });
                                    } else {
                                        const textData = await docRes.text();
                                        parts.push({ type: 'text', text: `[Attached Text/CSV Document: ${att.name || 'document'}]\n\n${textData.substring(0, 25000)}` });
                                    }
                                } else {
                                    parts.push({ type: 'text', text: `[Attached Document: ${att.name}] (System Error: Could not download text)` });
                                }
                            } catch (err) {
                                systemLogger.error("[CHAT_DOC_EXTRACT_ERROR]", err);
                                parts.push({ type: 'text', text: `[Attached Document: ${att.name}] (System Error: Extract failed)` });
                            }
                        } else {
                            try {
                                const imgRes = await safeFetch(finalUrlString);
                                if (!imgRes.ok) throw new Error("Failed to fetch image");
                                const ab = await imgRes.arrayBuffer();
                                
                                const sharp = (await import('sharp')).default;
                                const resized = await sharp(Buffer.from(ab))
                                    .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
                                    .jpeg({ quality: 80 })
                                    .toBuffer();
                                
                                parts.push({ type: 'image', image: resized, mimeType: 'image/jpeg' });
                            } catch (e) {
                                systemLogger.warn("[CHAT_IMAGE_COMPRESSION_ERROR]", e);
                                parts.push({ type: 'image', image: fileUrl });
                            }
                        }
                    } catch (e) {
                        systemLogger.warn("[CHAT_ATTACHMENT_URL_ERROR]", e);
                    }
                }

                if (parts.length > 0) {
                    modelMessages[lastUserIdx] = { ...targetMessage, content: parts };
                }
            }
        }

        // Call Azure OpenAI (or fallback OpenAI) with streaming
        const requiresVision = uploadedAttachments && uploadedAttachments.length > 0;
        
        // Build CRM tools if we have a team context
        let teamIdForTools: string | null = null;
        try {
            const toolUser = await prismadb.users.findUnique({
                where: { id: auth.user.id },
                select: { team_id: true }
            });
            teamIdForTools = toolUser?.team_id || null;
        } catch (_) {}

        let aiModelResult;
        try {
            aiModelResult = await getAiSdkModel({ userId: auth.user.id, teamId: teamIdForTools || undefined }, "chat", requiresVision);
        } catch (modelErr: any) {
            if (modelErr.message?.includes("VISION_UNSUPPORTED_MODEL")) {
                const modelName = modelErr.message.split(":")[1] || "The selected model";
                return new NextResponse(`${modelName} does not support image or multimodal attachments. Please remove the attachments or switch models.`, { status: 400 });
            }
            throw modelErr;
        }

        const { model } = aiModelResult;
        if (!model) {
            return new NextResponse("No openai key found", { status: 500 });
        }

        const crmTools = teamIdForTools ? buildCrmTools(teamIdForTools, auth.user.id) : {};

        let result: any;
        try {
            // Omit temperature for reasoning models (o1, etc.)
            // For Qwen and other standard models, use low temperature and penalties to prevent repetition loops and hallucinations
            const temperature = isReasoningModel(model.modelId) ? undefined : 0.1;
            const frequencyPenalty = isReasoningModel(model.modelId) ? undefined : 0.7;
            const presencePenalty = isReasoningModel(model.modelId) ? undefined : 0.5;

            result = streamText({
                model,
                system: systemPrompt,
                messages: modelMessages.filter((m: any) => m.role !== 'system'),
                temperature,
                frequencyPenalty,
                presencePenalty,
                maxOutputTokens: 4096,
                tools: crmTools,
                stopWhen: stepCountIs(5),
                onFinish: async ({ text: completion, usage }: any) => {
                    try {
                        if (!chatSession.isTemporary) {
                            await db.chat_Messages.create({
                                data: {
                                    session: sessionId,
                                    parent: userMessageId || parentId || undefined,
                                    role: "assistant",
                                    content: completion,
                                    model: model.modelId,
                                    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || undefined,
                                    tokenUsage: usage || undefined,
                                },
                            });
                            await db.chat_Sessions.update({
                                where: { id: sessionId },
                                data: { updatedAt: new Date() },
                            });
                        }

                        // Log usage and consume AI tokens via centralized logAiUsage
                        if (usage) {
                            const usageAny = usage as any;
                            try {
                                const chatUser = await prismadb.users.findUnique({
                                    where: { id: auth!.user.id },
                                    select: { team_id: true }
                                });
                                if (chatUser?.team_id) {
                                    await logAiUsage({
                                        teamId: chatUser.team_id,
                                        userId: auth!.user.id,
                                        service: "chat",
                                        model: model.modelId || "unknown",
                                        usage: {
                                            promptTokens: usageAny.promptTokens || 0,
                                            completionTokens: usageAny.completionTokens || 0
                                        },
                                        description: "Chat completion"
                                    });
                                }
                            } catch (tokenErr) {
                                systemLogger.error("[CHAT_AI_TOKEN_CONSUME_ERROR]", tokenErr);
                            }
                        }
                    } catch (e) {
                        systemLogger.error("[CHAT_MESSAGES_ON_COMPLETION_SAVE_ERROR]", e);
                    }
                },
            });
        } catch (err) {
            systemLogger.error("[CHAT_STREAM_TEXT_ERROR]", err);
            return new NextResponse("Error calling streamText", { status: 500 });
        }

        // Use toUIMessageStreamResponse per AI SDK v6 docs for proper useChat integration
        if (result && typeof result.toUIMessageStreamResponse === 'function') {
            return result.toUIMessageStreamResponse();
        } else if (result && typeof result.toDataStreamResponse === 'function') {
            return result.toDataStreamResponse();
        } else if (result instanceof Response) {
            return result;
        } else {
            systemLogger.error("[CHAT_STREAM_ERROR] Invalid result object:", result);
            return new NextResponse("Stream generation failed: Invalid result", { status: 500 });
        }

    } catch (error) {
        systemLogger.error("[CHAT_MESSAGES_POST]", error);
        return new NextResponse("Failed to process message", { status: 500 });
    }
}
