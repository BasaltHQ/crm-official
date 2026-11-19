import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

async function verifyOpportunityAccess(id: string) {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return { error, session: null };

    const opportunity = await prismadb.crm_Opportunities.findUnique({
        where: { id },
        select: { id: true, team_id: true },
    });
    if (!opportunity) {
        return { error: new NextResponse("Opportunity not found", { status: 404 }), session: null };
    }
    if (!validateResourceOwnership(teamInfo!.teamId, opportunity.team_id, teamInfo!.isPlatformAdmin)) {
        return { error: new NextResponse("Forbidden", { status: 403 }), session: null };
    }
    return { error: null, session };
}

/**
 * GET /api/crm/opportunities/[id]/competitors
 * List all competitors for an opportunity.
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const access = await verifyOpportunityAccess(id);
        if (access.error) return access.error;

        const competitors = await prismadb.crm_Opportunity_Competitors.findMany({
            where: { opportunity_id: id },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(competitors);
    } catch (error) {
        console.error("[COMPETITORS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * POST /api/crm/opportunities/[id]/competitors
 * Add a competitor to an opportunity.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const access = await verifyOpportunityAccess(id);
        if (access.error) return access.error;

        const body = await req.json();

        const competitor = await prismadb.crm_Opportunity_Competitors.create({
            data: {
                opportunity_id: id,
                name: body.name,
                website: body.website || null,
                contact_name: body.contact_name || null,
                product: body.product || null,
                strengths: body.strengths || null,
                weaknesses: body.weaknesses || null,
                strategy: body.strategy || null,
                threat_level: body.threat_level || "MEDIUM",
                outcome: body.outcome || "ACTIVE",
                price_position: body.price_position || null,
                createdBy: access.session!.user.id,
            },
        });

        return NextResponse.json(competitor);
    } catch (error) {
        console.error("[COMPETITORS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

/**
 * DELETE /api/crm/opportunities/[id]/competitors
 * Remove a competitor. Expects { competitorId } in body.
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const access = await verifyOpportunityAccess(id);
        if (access.error) return access.error;

        const body = await req.json();
        const { competitorId } = body;

        if (!competitorId) {
            return new NextResponse("competitorId required", { status: 400 });
        }

        const deleted = await prismadb.crm_Opportunity_Competitors.deleteMany({
            where: { id: competitorId, opportunity_id: id },
        });

        if (deleted.count === 0) {
            return new NextResponse("Competitor not found", { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[COMPETITORS_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
