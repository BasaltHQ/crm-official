"use server";

import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getOutreachStats = async () => {
    try {
        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin) return null;

        const campaigns = await prismadb.crm_Outreach_Campaigns.findMany({
            where: {
                ...(teamInfo.isGlobalAdmin ? {} : { team_id: teamInfo.teamId }),
                status: "ACTIVE"
            },
            select: {
                name: true,
                emails_sent: true,
                emails_opened: true,
                meetings_booked: true,
                total_leads: true
            },
            orderBy: {
                createdAt: "desc"
            },
            take: 5
        });

        if (campaigns.length === 0) return null;

        const aggregate = campaigns.reduce((acc, curr) => ({
            emails_sent: acc.emails_sent + curr.emails_sent,
            emails_opened: acc.emails_opened + curr.emails_opened,
            meetings_booked: acc.meetings_booked + curr.meetings_booked,
            total_leads: acc.total_leads + curr.total_leads
        }), { emails_sent: 0, emails_opened: 0, meetings_booked: 0, total_leads: 0 });

        const openRate = aggregate.emails_sent > 0 ? (aggregate.emails_opened / aggregate.emails_sent) * 100 : 0;
        const bookingRate = aggregate.total_leads > 0 ? (aggregate.meetings_booked / aggregate.total_leads) * 100 : 0;

        return {
            campaigns,
            aggregate,
            openRate,
            bookingRate
        };
    } catch (error) {
        console.error("Error fetching outreach stats:", error);
        return null;
    }
};
