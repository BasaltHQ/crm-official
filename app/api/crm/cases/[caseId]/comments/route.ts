import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

// POST: Add a comment to a case
export async function POST(
    req: Request,
    { params }: { params: Promise<{ caseId: string }> }
) {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    try {
        const { caseId } = await params;
        const body = await req.json();
        const { body: commentBody, is_public = true } = body;

        if (!commentBody) {
            return new NextResponse("Comment body is required", { status: 400 });
        }

        // Verify case exists and belongs to the caller's tenant
        const caseRecord = await (prismadb as any).crm_Cases.findUnique({
            where: { id: caseId },
            select: { id: true, team_id: true, first_response_at: true, status: true },
        });

        if (!caseRecord) {
            return new NextResponse("Case not found", { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, caseRecord.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const comment = await (prismadb as any).crm_Case_Comments.create({
            data: {
                case_id: caseId,
                body: commentBody,
                is_public,
                author_id: session!.user.id,
            },
            include: {
                author: {
                    select: { id: true, name: true, email: true, avatar: true },
                },
            },
        });

        // Mark first response if this is the first agent comment on a NEW/OPEN case
        if (
            !caseRecord.first_response_at &&
            ["NEW", "OPEN"].includes(caseRecord.status)
        ) {
            await (prismadb as any).crm_Cases.update({
                where: { id: caseId },
                data: {
                    first_response_at: new Date(),
                    status: caseRecord.status === "NEW" ? "OPEN" : caseRecord.status,
                },
            });
        }

        return NextResponse.json(comment, { status: 201 });
    } catch (error) {
        systemLogger.error("[CREATE_CASE_COMMENT_POST]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}

// GET: Get all comments for a case
export async function GET(
    req: Request,
    { params }: { params: Promise<{ caseId: string }> }
) {
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    try {
        const { caseId } = await params;
        const caseRecord = await (prismadb as any).crm_Cases.findUnique({
            where: { id: caseId },
            select: { id: true, team_id: true },
        });
        if (!caseRecord) {
            return new NextResponse("Case not found", { status: 404 });
        }
        if (!validateResourceOwnership(teamInfo!.teamId, caseRecord.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const comments = await (prismadb as any).crm_Case_Comments.findMany({
            where: { case_id: caseId },
            include: {
                author: {
                    select: { id: true, name: true, email: true, avatar: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(comments, { status: 200 });
    } catch (error) {
        systemLogger.error("[GET_CASE_COMMENTS]", error);
        return new NextResponse("Internal error", { status: 500 });
    }
}
