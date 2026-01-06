import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

// PATCH: Update submission status (delete, restore, archive)
export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;
        const teamId = (session.user as any).team_id;

        const body = await req.json();
        const { submissionId, action } = body;

        if (!submissionId) {
            return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
        }

        // Get the submission first
        const submission = await (prismadb as any).formSubmission.findUnique({
            where: { id: submissionId },
        });

        if (!submission) {
            return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        }

        // Verify access - check team_id if available, otherwise allow
        if (teamId && submission.team_id && submission.team_id !== teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const teamId = (session.user as any).team_id;

        const { searchParams } = new URL(req.url);
        const submissionId = searchParams.get("submissionId");

        if (!submissionId) {
            return NextResponse.json({ error: "Submission ID required" }, { status: 400 });
        }

        // Get the submission first
        const submission = await (prismadb as any).formSubmission.findUnique({
            where: { id: submissionId },
        });

        if (!submission) {
            return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        }

        // Verify access
        if (teamId && submission.team_id && submission.team_id !== teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
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
