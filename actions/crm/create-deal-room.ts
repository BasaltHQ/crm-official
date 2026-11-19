"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";

export async function createDealRoom(contractId: string) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            throw new Error("Unauthorized");
        }

        const contract = await prismadb.crm_Contracts.findUnique({
            where: { id: contractId },
            select: { id: true, team_id: true },
        });
        if (!contract) {
            return { success: false, error: "Contract not found" };
        }
        if (!validateResourceOwnership(teamInfo.teamId, contract.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        // Check if exists
        const existing = await prismadb.crm_DealRooms.findFirst({
            where: { contract_id: contractId }
        });

        if (existing) {
            return { success: true, slug: existing.slug };
        }

        // Create new
        const slug = uuidv4();
        await prismadb.crm_DealRooms.create({
            data: {
                contract_id: contractId,
                slug: slug,
                is_active: true,
                valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
                allowed_addons: [
                    { name: "Priority Support (24/7)", price: 500, description: "Direct access to engineering team." },
                    { name: "Onboarding Package", price: 1200, description: "3 Sessions of dedicated training." }
                ]
            }
        });

        revalidatePath('/crm/contracts');
        return { success: true, slug };
    } catch (error) {
        console.error("Failed to create Deal Room:", error);
        return { success: false, error: "Failed to create deal room" };
    }
}
