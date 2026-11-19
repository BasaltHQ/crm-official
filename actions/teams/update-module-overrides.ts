"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/security/authz";

export async function updateModuleOverrides(teamId: string, overrides: string[]) {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { error: "Unauthorized: Platform Admin required." };
        }

        await prismadb.team.update({
            where: { id: teamId },
            data: {
                module_overrides: overrides
            }
        });

        revalidatePath(`/partners/${teamId}`);
        revalidatePath(`/partners/${teamId}/modules`);

        return { success: true };
    } catch (error) {
        console.error("Update Module Overrides Error:", error);
        return { error: "Failed to update overrides" };
    }
}
