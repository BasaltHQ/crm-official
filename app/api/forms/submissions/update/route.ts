import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function PATCH(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const body = await req.json();
        const { submissionId, status } = body;

        if (!submissionId || !status) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const submission = await prismadb.formSubmission.findUnique({
            where: { id: submissionId },
            include: { form: { select: { team_id: true } } },
        });

        if (!submission) {
            return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        }

        const resourceTeamId = submission.team_id || submission.form?.team_id || null;
        if (!validateResourceOwnership(teamInfo!.teamId, resourceTeamId, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const updated = await prismadb.formSubmission.update({
            where: { id: submissionId },
            data: { status: status }
        });

        return NextResponse.json(updated);
    } catch (error) {
        systemLogger.error("[SUBMISSION_UPDATE]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
