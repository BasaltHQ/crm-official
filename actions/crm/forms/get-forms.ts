"use server";

import { getSessionAndTeam } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

export async function getActiveForms() {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo?.teamId) {
            return [];
        }

        const teamId = teamInfo.teamId;

        const forms = await (prismadb as any).form.findMany({
            where: {
                team_id: teamId,
                status: "ACTIVE"
            },
            select: {
                id: true,
                slug: true,
                name: true
            },
            orderBy: {
                name: "asc"
            }
        });

        return forms.map((form: any) => ({
            id: form.slug, // We use slug as the trigger target
            name: form.name
        }));
    } catch (error) {
        console.error("Failed to fetch active forms:", error);
        return [];
    }
}
