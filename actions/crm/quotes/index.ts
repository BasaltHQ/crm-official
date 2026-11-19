"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";

export async function getQuotes() {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo?.teamId) return [];

        const quotes = await prismadb.crm_Quotes.findMany({
            where: {
                team_id: teamInfo.teamId,
            },
            include: {
                account: true,
                contact: true,
                lead: true,
                team: true,
                items: {
                    include: {
                        product: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return (quotes as any[]).map(q => ({
            ...q,
            taxRate: q.taxRateValue || 0
        }));

    } catch (error) {
        systemLogger.error("[GET_QUOTES]", error);
        return [];
    }
}

export async function createQuote(data: {
    title: string;
    accountId?: string;
    contactId?: string;
    leadId?: string;
    opportunityId?: string;
    items: {
        productId?: string;
        name?: string;
        description?: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        totalPrice: number;
    }[];
    totalAmount: number;
    taxRate?: number;
    notes?: string;
    terms?: string;
    payerMemo?: string;
    attachments?: string[];
    expirationDate?: Date;
}) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) throw new Error("Unauthorized");
        const teamId = teamInfo.teamId;

        // Verify ownership of all linked CRM entities BEFORE creating quote or logging activity
        if (data.accountId) {
            const acc = await prismadb.crm_Accounts.findUnique({
                where: { id: data.accountId },
                select: { id: true, team_id: true },
            });
            if (!acc || !validateResourceOwnership(teamId, acc.team_id, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden — invalid accountId");
            }
        }

        if (data.contactId) {
            const contact = await prismadb.crm_Contacts.findUnique({
                where: { id: data.contactId },
                select: { id: true, team_id: true },
            });
            if (!contact || !validateResourceOwnership(teamId, contact.team_id, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden — invalid contactId");
            }
        }

        if (data.leadId) {
            const lead = await prismadb.crm_Leads.findUnique({
                where: { id: data.leadId },
                select: { id: true, team_id: true },
            });
            if (!lead || !validateResourceOwnership(teamId, lead.team_id, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden — invalid leadId");
            }
        }

        if (data.opportunityId) {
            const opp = await prismadb.crm_Opportunities.findUnique({
                where: { id: data.opportunityId },
                select: { id: true, team_id: true },
            });
            if (!opp || !validateResourceOwnership(teamId, opp.team_id, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden — invalid opportunityId");
            }
        }

        const productIds = Array.from(
            new Set((data.items || []).map((i) => i.productId).filter(Boolean))
        ) as string[];
        if (productIds.length > 0 && !teamInfo.isPlatformAdmin) {
            const ownedProducts = await prismadb.crm_Products.count({
                where: { id: { in: productIds }, team_id: teamId },
            });
            if (ownedProducts !== productIds.length) {
                throw new Error("Forbidden — invalid productId in quote items");
            }
        }

        const quoteNumber = `Q-${Math.floor(100000 + Math.random() * 900000)}`;

        const createData: any = {
            title: data.title,
            quoteNumber,
            status: "DRAFT",
            totalAmount: Number(data.totalAmount || 0),
            taxRateValue: Number(data.taxRate || 0),
            notes: data.notes || "",
            terms: data.terms || "Standard payment terms apply. Valid for 30 days.",
            payerMemo: data.payerMemo || "",
            attachments: data.attachments || [],
            expirationDate: data.expirationDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            createdBy: session.user.id,
            team_id: teamId,
            items: {
                create: data.items.map(item => ({
                    productId: item.productId,
                    name: item.name || "Custom Item",
                    description: item.description || "",
                    quantity: Math.floor(Number(item.quantity || 1)),
                    unitPrice: Number(item.unitPrice || 0),
                    discount: Number(item.discount || 0),
                    totalPrice: Number(item.totalPrice || 0)
                }))
            }
        };

        if (data.accountId) createData.accountId = data.accountId;
        if (data.contactId) createData.contactId = data.contactId;
        if (data.leadId) createData.leadId = data.leadId;
        if (data.opportunityId) createData.opportunityId = data.opportunityId;

        const quote = await (prismadb.crm_Quotes as any).create({
            data: createData
        });

        // Record activity for the lead if applicable
        if (data.leadId) {
            try {
                await prismadb.crm_Lead_Activities.create({
                    data: {
                        lead: data.leadId,
                        user: session.user.id,
                        type: "note",
                        metadata: {
                            text: `Created Proposal: ${data.title} (${quoteNumber}) - Total: $${data.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
                            quoteId: quote.id,
                            quoteNumber: quoteNumber,
                            action: "QUOTE_CREATED"
                        }
                    }
                });
            } catch (activityError) {
                console.warn("[CREATE_QUOTE_ACTIVITY_ERROR]", activityError);
                // Don't fail the whole quote creation if activity fails
            }
        }



        revalidatePath("/crm/quotes");

        import("@/actions/quests/add-raw-xp")
          .then((m) => m.addRawXP({ userId: session.user.id, xpAmount: 10, reason: "Drafted CPQ Quote" }))
          .catch((e) => systemLogger.warn(`[CREATE_QUOTE_GAMIFICATION] Failed to award XP: ${e?.message}`));

        return { success: true, quoteId: quote.id };
    } catch (error: any) {
        systemLogger.error("[CREATE_QUOTE]", error);
        return { success: false, error: error.message };
    }
}

export async function getQuoteById(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) return null;

        const quote = await prismadb.crm_Quotes.findUnique({
            where: { id },
            include: {
                account: true,
                contact: true,
                opportunity: true,
                lead: true,
                team: true,
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        if (!quote) return null;
        if (!validateResourceOwnership(teamInfo.teamId, quote.team_id, teamInfo.isPlatformAdmin)) {
            return null;
        }
        return {
            ...quote,
            taxRate: (quote as any).taxRateValue || 0
        };

    } catch (error) {
        systemLogger.error("[GET_QUOTE_BY_ID]", error);
        return null;
    }
}

export async function cancelQuote(id: string) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) throw new Error("Unauthorized");

        const existing = await prismadb.crm_Quotes.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing) throw new Error("Quote not found");
        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            throw new Error("Forbidden");
        }

        const quote = await prismadb.crm_Quotes.update({
            where: { id },
            data: {
                status: "REJECTED"
            }
        });

        if (quote.leadId) {
            try {
                await prismadb.crm_Lead_Activities.create({
                    data: {
                        lead: quote.leadId,
                        user: session.user.id,
                        type: "note",
                        metadata: {
                            text: `Cancelled Quote: ${quote.title} (${quote.quoteNumber})`,
                            quoteId: quote.id,
                            action: "QUOTE_CANCELLED"
                        }
                    }
                });
            } catch (activityError) {
                console.warn("[CANCEL_QUOTE_ACTIVITY_ERROR]", activityError);
            }
        }

        revalidatePath("/crm/quotes");
        revalidatePath(`/crm/quotes/${id}`);
        return { success: true };
    } catch (error: any) {
        systemLogger.error("[CANCEL_QUOTE]", error);
        return { success: false, error: error.message };
    }
}

export async function deleteQuote(id: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");

        // Verify quote exists and belongs to caller's team BEFORE deleting crm_QuoteItems!
        const existing = await prismadb.crm_Quotes.findUnique({
            where: { id },
            select: { id: true, team_id: true },
        });
        if (!existing) throw new Error("Quote not found");
        if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
            throw new Error("Forbidden");
        }

        await prismadb.crm_QuoteItems.deleteMany({
            where: {
                quoteId: id
            }
        });

        await prismadb.crm_Quotes.delete({
            where: { id }
        });

        revalidatePath("/crm/quotes");
        return { success: true };
    } catch (error: any) {
        systemLogger.error("[DELETE_QUOTE]", error);
        return { success: false, error: error.message };
    }
}
