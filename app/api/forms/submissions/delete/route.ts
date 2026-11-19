import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

// PATCH: Update submission status (delete, restore, archive)
export async function PATCH(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const body = await req.json();
        const { submissionId, action } = body;

        if (!submissionId) {
            return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
        }

        // Get the submission first
        const submission = await (prismadb as any).formSubmission.findUnique({
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

        let updateData: any = {};
        let message: string = "";

        switch (action) {
            case "restore":
                // Restore to NEW and un-delete
                updateData = { status: "NEW", is_deleted: false };
                message = "Submission restored";
                break;
            case "archive":
                updateData = { status: "ARCHIVED", is_deleted: false };
                message = "Submission archived";
                break;
            case "delete":
            default:
                // Soft delete
                updateData = { is_deleted: true };
                message = "Submission moved to trash";
                break;
        }

        const updated = await (prismadb as any).formSubmission.update({
            where: { id: submissionId },
            data: updateData,
        });

        return NextResponse.json({
            success: true,
            message,
            submission: updated
        });
    } catch (error) {
        console.error("Error updating submission:", error);
        return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
    }
}

// DELETE: Permanent delete
export async function DELETE(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const { searchParams } = new URL(req.url);
        const submissionId = searchParams.get("submissionId");

        if (!submissionId) {
            return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
        }

        // Get the submission first
        const submission = await (prismadb as any).formSubmission.findUnique({
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

        // Permanently delete
        await (prismadb as any).formSubmission.delete({
            where: { id: submissionId },
        });

        return NextResponse.json({
            success: true,
            message: "Submission permanently deleted"
        });
    } catch (error) {
        console.error("Error deleting submission:", error);
        return NextResponse.json({ error: "Failed to delete submission" }, { status: 500 });
    }
}
