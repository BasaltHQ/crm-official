import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20));
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";

    const skip = (page - 1) * limit;

    try {
        const whereClause: Prisma.crm_Outreach_ItemsWhereInput = {
            assigned_campaign: {
                team_id: params.teamId
            }
        };

        if (status && status !== "ALL") {
            // @ts-ignore
            whereClause.status = status;
        }

        if (search) {
            whereClause.OR = [
                { subject: { contains: search, mode: "insensitive" } },
                {
                    assigned_lead: {
                        OR: [
                            { firstName: { contains: search, mode: "insensitive" } },
                            { lastName: { contains: search, mode: "insensitive" } },
                            { email: { contains: search, mode: "insensitive" } },
                            { company: { contains: search, mode: "insensitive" } }
                        ]
                    }
                }
            ];
        }

        const [items, total] = await Promise.all([
            prismadb.crm_Outreach_Items.findMany({
                where: whereClause,
                take: limit,
                skip: skip,
                orderBy: {
                    sentAt: "desc"
                },
                include: {
                    assigned_lead: {
                        select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                            company: true
                        }
                    }
                }
            }),
            prismadb.crm_Outreach_Items.count({
                where: whereClause
            })
        ]);

        const mapped = (items as any[]).map(item => ({
            id: item.id,
            lead: item.assigned_lead,
            subject: item.subject,
            body_html: item.body_html,
            body_text: item.body_text,
            sentAt: item.sentAt || item.createdAt,
            status: item.status
        }));

        return NextResponse.json({
            data: mapped,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        console.error("Failed to fetch emails", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
