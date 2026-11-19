"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";

export type ActionResponse = {
    success: boolean;
    data?: any;
    error?: string;
};

export async function convertLeadToOpportunity(leadId: string): Promise<ActionResponse> {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) {
            return { success: false, error: "Unauthorized" };
        }

        const lead = await prismadb.crm_Leads.findUnique({
            where: { id: leadId },
        });

        if (!lead) {
            return { success: false, error: "Lead not found" };
        }

        if (!validateResourceOwnership(teamInfo.teamId, lead.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        if (lead.status === "CONVERTED") {
            return { success: false, error: "Lead is already converted" };
        }

        const targetTeamId = lead.team_id || teamInfo.teamId;

        // 0.5 Create/Find Account (strictly scoped to lead's tenant)
        let accountId = lead.accountsIDs || "";

        if (lead.company && !accountId) {
            const existingAccount = await prismadb.crm_Accounts.findFirst({
                where: {
                    name: lead.company,
                    ...(targetTeamId ? { team_id: targetTeamId } : {}),
                },
            });
            if (existingAccount) {
                accountId = existingAccount.id;
            } else {
                const newAccount = await prismadb.crm_Accounts.create({
                    data: {
                        v: 0,
                        name: lead.company,
                        email: lead.email,
                        office_phone: lead.phone,
                        description: lead.description,
                        assigned_to_user: lead.assigned_to ? { connect: { id: lead.assigned_to } } : undefined,
                        assigned_team: targetTeamId ? { connect: { id: targetTeamId } } : undefined,
                    }
                });
                accountId = newAccount.id;
            }

            await prismadb.crm_Leads.update({
                where: { id: lead.id },
                data: { accountsIDs: accountId }
            });
        }

        // 1. Create/Find Contact (strictly scoped to lead's tenant)
        let contactId = "";
        if (lead.email) {
            const existingContact = await prismadb.crm_Contacts.findFirst({
                where: {
                    email: lead.email,
                    ...(targetTeamId ? { team_id: targetTeamId } : {}),
                },
            });
            if (existingContact) {
                contactId = existingContact.id;

                if (accountId && !existingContact.accountsIDs) {
                    await prismadb.crm_Contacts.update({
                        where: { id: contactId },
                        data: { assigned_accounts: { connect: { id: accountId } } }
                    });
                }
            }
        }

        if (!contactId) {
            const newContact = await prismadb.crm_Contacts.create({
                data: {
                    first_name: lead.firstName || "",
                    last_name: lead.lastName,
                    email: lead.email,
                    mobile_phone: lead.phone,
                    position: lead.jobTitle,
                    description: lead.company ? `Company: ${lead.company}\n${lead.description || ""}` : lead.description,
                    assigned_to_user: lead.assigned_to ? { connect: { id: lead.assigned_to } } : undefined,
                    crate_by_user: { connect: { id: session.user.id } },
                    assigned_team: targetTeamId ? { connect: { id: targetTeamId } } : undefined,
                    type: "Prospect",
                    assigned_accounts: accountId ? { connect: { id: accountId } } : undefined,
                },
            });
            contactId = newContact.id;
        }

        // 2. Create Opportunity
        const opportunityName = lead.company
            ? `${lead.company}`
            : `${lead.firstName} ${lead.lastName}`;

        // Project relation data
        const projectData = lead.project ? {
            assigned_project: {
                connect: { id: lead.project }
            }
        } : {};

        const newOpportunity = await prismadb.crm_Opportunities.create({
            data: {
                name: opportunityName,
                description: `Converted from Lead: ${lead.firstName} ${lead.lastName}\n\n${lead.description || ""}`,
                status: "ACTIVE",
                // pipeline_stage does not exist in crm_Opportunities

                createdBy: session.user.id,
                updatedBy: session.user.id,
                created_by_user: { connect: { id: session.user.id } }, // Relation (sets created_by)
                assigned_to_user: lead.assigned_to ? { connect: { id: lead.assigned_to } } : { connect: { id: session.user.id } },

                // Relations
                ...projectData,

                assigned_account: accountId ? { connect: { id: accountId } } : undefined,

                contacts: {
                    connect: [{ id: contactId }]
                },
                // Removed invalid scalar contact: contactId
                assigned_lead: { connect: { id: lead.id } },
                assigned_team: lead.team_id ? { connect: { id: lead.team_id } } : undefined,

                budget: 0,
                expected_revenue: 0,
                close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
            },
        });

        // 3. Update Lead
        await prismadb.crm_Leads.update({
            where: { id: leadId },
            data: {
                status: "CONVERTED",
            },
        });

        revalidatePath("/crm/leads");
        revalidatePath("/crm/opportunities");
        revalidatePath(`/crm/leads/${leadId}`);

        // Quest progress — fire-and-forget
        if (lead.team_id) {
            import("@/actions/quests/increment-progress").then(({ incrementQuestProgress }) => {
                incrementQuestProgress({ userId: session.user.id, teamId: lead.team_id!, questType: "close_leads" }).catch(() => { });
                incrementQuestProgress({ userId: session.user.id, teamId: lead.team_id!, questType: "convert_accounts" }).catch(() => { });
                incrementQuestProgress({ userId: session.user.id, teamId: lead.team_id!, questType: "create_opportunities" }).catch(() => { });
            }).catch(() => { });
        }

        import("@/actions/quests/add-raw-xp")
          .then((m) => m.addRawXP({ userId: session.user.id, xpAmount: 20, reason: "Converted Lead to Opportunity" }))
          .catch((e) => systemLogger.warn(`[CONVERT_LEAD_GAMIFICATION] Failed to award XP: ${e?.message}`));

        return {
            success: true,
            data: {
                opportunityId: newOpportunity.id,
                contactId
            }
        };

    } catch (error: any) {
        systemLogger.error("[CONVERT_LEAD]", error);
        return { success: false, error: error.message || "Failed to convert lead" };
    }
}
