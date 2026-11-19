"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { requirePlatformAdmin } from "@/lib/security/authz";

export const updateTeamRenewal = async (
    teamId: string,
    renewalDate: Date | null
) => {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { error: "Unauthorized: Platform Admin required." };
        }

        await prismadb.team.update({
            where: {
                id: teamId,
            },
            data: {
                renewal_date: renewalDate,
            },
        });

        revalidatePath("/partners");
        return { success: "Renewal date updated" };
    } catch (error) {
        systemLogger.error("[UPDATE_TEAM_RENEWAL]", error);
        return { error: "Internal Error" };
    }
};
