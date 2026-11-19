
"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

export const getInvoiceActivity = async (invoiceId: string) => {
    try {
        const trimmedInvoiceId = typeof invoiceId === "string" ? invoiceId.trim() : "";
        if (!trimmedInvoiceId) {
            return [];
        }

        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) {
            return [];
        }

        const invoice = await prismadb.invoices.findUnique({
            where: { id: trimmedInvoiceId },
            select: { id: true, team_id: true },
        });
        if (!invoice || !validateResourceOwnership(teamInfo.teamId, invoice.team_id, teamInfo.isPlatformAdmin)) {
            return [];
        }

        const targetTeamId = invoice.team_id || teamInfo.teamId;

        const activities = await prismadb.systemActivity.findMany({
            where: {
                ...(targetTeamId ? { team_id: targetTeamId } : {}),
                resource: {
                    contains: trimmedInvoiceId
                }
            },
            include: {
                user: {
                    select: {
                        name: true,
                        avatar: true
                    }
                }
            },
            orderBy: {
                createdAt: "desc"
            }
        });

        return (activities as any[]).map(a => ({
            id: a.id,
            user: a.user?.name || "System",
            action: a.action,
            details: a.details,
            timestamp: a.createdAt,
        }));
    } catch (error) {
        console.error("Error fetching invoice activity:", error);
        return [];
    }
};
