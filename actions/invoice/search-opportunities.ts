"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function searchOpportunities(query: string) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) return [];

        const teamId = teamInfo.teamId;
        if (!teamId && !teamInfo.isPlatformAdmin) return [];

        const textSearch = [
            { name: { contains: query, mode: "insensitive" as const } },
            { description: { contains: query, mode: "insensitive" as const } }
        ];

        // Strictly scope CRM opportunities to caller's team (unless platform admin)
        const whereClause: any = teamInfo.isPlatformAdmin && !teamId
            ? { OR: textSearch }
            : {
                team_id: teamId,
                OR: textSearch,
            };

        const crmOppsPromise = prismadb.crm_Opportunities.findMany({
            where: whereClause,
            take: 20,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, name: true, description: true }
        });

        // Strictly scope Project Opportunities to projects owned by caller's team
        const projOppsPromise = prismadb.project_Opportunities.findMany({
            where: {
                ...(teamInfo.isPlatformAdmin && !teamId
                    ? {}
                    : { assigned_project: { team_id: teamId } }),
                OR: [
                    { title: { contains: query, mode: "insensitive" } },
                    { description: { contains: query, mode: "insensitive" } }
                ]
            },
            take: 20,
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, description: true, project: true, assigned_project: { select: { title: true } } }
        });

        const [crmOpps, projOpps] = await Promise.all([crmOppsPromise, projOppsPromise]);

        const results = [];

        // Map CRM Opps
        results.push(...(crmOpps as any[]).map(op => ({
            id: op.id,
            title: op.name || "Untitled Opportunity",
            subtitle: op.description || "CRM Opportunity",
            type: "crm_opportunity" // Explicit type
        })));

        // Map Project Opps (Features)
        results.push(...(projOpps as any[]).map(op => ({
            id: op.id,
            title: op.title,
            subtitle: `${op.assigned_project?.title || 'Project'} Feature` + (op.description ? ` - ${op.description}` : ""),
            type: "project_opportunity"
        })));

        return results;

    } catch (error) {
        systemLogger.error("[SEARCH_OPPORTUNITIES_ERROR]", error);
        return [];
    }
}
