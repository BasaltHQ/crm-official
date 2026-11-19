import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

export async function GET(_req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const items = await prismadb.crm_Outreach_Items.findMany({
            where: {
                status: "SENT",
                assigned_campaign: {
                    team_id: params.teamId
                }
            },
            take: 10,
            orderBy: {
                sentAt: "desc"
            },
            select: {
                id: true,
                subject: true,
                status: true,
                sentAt: true,
                createdAt: true,
                candidate_email: true,
                candidate_name: true,
                candidate_company: true,
                assigned_lead: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                        company: true
                    }
                }
            }
        });

        const mapped = (items as any[]).map(item => {
            const lead = item.assigned_lead || {
                firstName: item.candidate_name?.split(" ")[0] || "",
                lastName: item.candidate_name?.split(" ").slice(1).join(" ") || "",
                email: item.candidate_email || "Unknown",
                company: item.candidate_company || "",
            };
            return {
                id: item.id,
                lead,
                subject: item.subject,
                sentAt: item.sentAt || item.createdAt,
                status: item.status
            };
        });

        return NextResponse.json(mapped);
    } catch (error: any) {
        console.error("Failed to fetch email stats", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
