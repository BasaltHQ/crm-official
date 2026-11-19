"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";

export async function saveQuoteAsDocument(data: {
    quoteId: string;
    documentUrl: string;
    documentName: string;
    leadId?: string;
    accountId?: string;
    contactId?: string;
    teamId: string;
}) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) throw new Error("Unauthorized");

        const quote = await prismadb.crm_Quotes.findUnique({
            where: { id: data.quoteId },
            select: { id: true, team_id: true },
        });
        if (!quote || !validateResourceOwnership(teamInfo.teamId, quote.team_id, teamInfo.isPlatformAdmin)) {
            throw new Error("Forbidden — invalid quoteId");
        }

        const effectiveTeamId = quote.team_id || teamInfo.teamId;
        if (!effectiveTeamId) {
            throw new Error("No team context");
        }

        if (data.leadId) {
            const lead = await prismadb.crm_Leads.findUnique({
                where: { id: data.leadId },
                select: { id: true, team_id: true },
            });
            if (!lead || !validateResourceOwnership(effectiveTeamId, lead.team_id, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden — invalid leadId");
            }
        }

        if (data.accountId) {
            const acc = await prismadb.crm_Accounts.findUnique({
                where: { id: data.accountId },
                select: { id: true, team_id: true },
            });
            if (!acc || !validateResourceOwnership(effectiveTeamId, acc.team_id, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden — invalid accountId");
            }
        }

        if (data.contactId) {
            const contact = await prismadb.crm_Contacts.findUnique({
                where: { id: data.contactId },
                select: { id: true, team_id: true },
            });
            if (!contact || !validateResourceOwnership(effectiveTeamId, contact.team_id, teamInfo.isPlatformAdmin)) {
                throw new Error("Forbidden — invalid contactId");
            }
        }

        const doc = await (prismadb.documents as any).create({
            data: {
                document_name: data.documentName,
                document_file_mimeType: "application/pdf",
                document_file_url: data.documentUrl,
                team_id: effectiveTeamId,
                status: "ACTIVE",
                assigned_user: session.user.id,
                leadsIDs: data.leadId ? [data.leadId] : [],
                accountsIDs: data.accountId ? [data.accountId] : [],
                contactsIDs: data.contactId ? [data.contactId] : [],
                visibility: "PRIVATE",
                document_system_type: "OFFER",
                notes: `Generated from Quote ID: ${data.quoteId}`
            }
        });

        // Revalidate paths
        if (data.leadId) revalidatePath("/crm/leads/" + data.leadId);
        if (data.accountId) revalidatePath("/crm/accounts/" + data.accountId);
        if (data.contactId) revalidatePath("/crm/contacts/" + data.contactId);


        // Add activity record
        if (data.leadId) {
            await prismadb.crm_Lead_Activities.create({
                data: {
                    lead: data.leadId,
                    user: session.user.id,
                    type: "note",
                    metadata: {
                        text: `Saved Quote PDF to Documents: ${data.documentName}`,
                        documentId: doc.id,
                        action: "DOCUMENT_UPLOADED"
                    }
                }
            });
        }

        revalidatePath("/crm/leads/" + data.leadId);
        return { success: true, documentId: doc.id };
    } catch (error: any) {
        systemLogger.error("[SAVE_QUOTE_AS_DOCUMENT]", error);
        return { success: false, error: error.message };
    }
}
