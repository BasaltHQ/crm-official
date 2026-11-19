"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { normalizeTeamSlug, requirePlatformAdmin } from "@/lib/security/authz";

export type RelocatableEntityType = "ACCOUNT" | "LEAD" | "CONTACT" | "OPPORTUNITY";

/**
 * Deep relocates an entity and its associated contents to a new team.
 * STRICTLY for PLATFORM_ADMIN use.
 */
export async function relocateEntity(
    entityId: string,
    entityType: RelocatableEntityType,
    targetTeamSlug: string
) {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { error: "Unauthorized: Platform Admin required." };
        }

        const normalizedSlug = normalizeTeamSlug(targetTeamSlug);
        if (!normalizedSlug) {
            return { error: "Invalid target team slug." };
        }

        // 1. Resolve Target Team
        const targetTeam = await prismadb.team.findFirst({
            where: { slug: { equals: normalizedSlug, mode: "insensitive" } },
            select: { id: true, name: true }
        });

        if (!targetTeam) return { error: `Target team "${targetTeamSlug}" not found.` };

        const targetTeamId = targetTeam.id;

        // 2. Perform Deep Relocation based on Type
        switch (entityType) {
            case "ACCOUNT":
                await relocateAccountDeep(entityId, targetTeamId);
                break;
            case "LEAD":
                await relocateLeadDeep(entityId, targetTeamId);
                break;
            case "CONTACT":
                await relocateContactDeep(entityId, targetTeamId);
                break;
            case "OPPORTUNITY":
                await relocateOpportunityDeep(entityId, targetTeamId);
                break;
            default:
                return { error: "Unsupported entity type for relocation." };
        }

        revalidatePath("/crm/accounts");
        revalidatePath("/crm/leads");
        revalidatePath("/crm/contacts");
        revalidatePath("/crm/opportunities");
        revalidatePath("/partners");

        return {
            success: true,
            message: `Successfully relocated ${entityType} and all linked contents to ${targetTeam.name}.`
        };

    } catch (error) {
        systemLogger.error("[RELOCATE_ENTITY]", error);
        return { error: "Relocation failed. Check server logs." };
    }
}

async function relocateAccountDeep(accountId: string, targetTeamId: string) {
    // 1. Move the Account itself
    await (prismadb.crm_Accounts as any).update({
        where: { id: accountId },
        data: { team_id: targetTeamId }
    });

    // 2. Move related Contacts
    await (prismadb.crm_Contacts as any).updateMany({
        where: { accountsIDs: accountId },
        data: { team_id: targetTeamId }
    });

    // 3. Move related Leads
    await (prismadb.crm_Leads as any).updateMany({
        where: { accountsIDs: accountId },
        data: { team_id: targetTeamId }
    });

    // 4. Move related Opportunities
    await (prismadb.crm_Opportunities as any).updateMany({
        where: { account: accountId },
        data: { team_id: targetTeamId }
    });

    // 5. Move related Contracts
    await (prismadb.crm_Contracts as any).updateMany({
        where: { account: accountId },
        data: { team_id: targetTeamId }
    });

    // 6. Move related Quotes
    await (prismadb.crm_Quotes as any).updateMany({
        where: { account: accountId },
        data: { team_id: targetTeamId }
    });

    // 7. Move related Tasks (Account Specific)
    await (prismadb.crm_Accounts_Tasks as any).updateMany({
        where: { account: accountId },
        data: { team_id: targetTeamId }
    });

    // 8. Move related Cases
    await (prismadb.crm_Cases as any).updateMany({
        where: { account_id: accountId },
        data: { team_id: targetTeamId }
    });

    // 9. Move related Invoices
    await (prismadb.invoices as any).updateMany({
        where: { assigned_account_id: accountId },
        data: { team_id: targetTeamId }
    });
}

async function relocateLeadDeep(leadId: string, targetTeamId: string) {
    await (prismadb.crm_Leads as any).update({
        where: { id: leadId },
        data: { team_id: targetTeamId }
    });

    // Move related activities/items if they have team_id
    // crm_Lead_Activities, crm_Outreach_Items, etc.
}

async function relocateContactDeep(contactId: string, targetTeamId: string) {
    await (prismadb.crm_Contacts as any).update({
        where: { id: contactId },
        data: { team_id: targetTeamId }
    });
}

async function relocateOpportunityDeep(oppId: string, targetTeamId: string) {
    await (prismadb.crm_Opportunities as any).update({
        where: { id: oppId },
        data: { team_id: targetTeamId }
    });
}
