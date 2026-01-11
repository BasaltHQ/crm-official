import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request, props: { params: Promise<{ teamId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
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
            // @ts-ignore - Status enum matching might need casting, but string works for Prisma filters often
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
                    sentAt: 'desc'
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

        const mapped = items.map(item => ({
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
        return new NextResponse(error.message, { status: 500 });
    }
}
