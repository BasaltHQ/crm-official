import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { escapeHtml } from "@/lib/security/ssrf-guard";
import sendEmail from "@/lib/sendmail";
import { generateSubmissionPdf } from "@/lib/pdf-utils";
import { systemLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        let body;
        try {
            body = await req.json();
        } catch (e) {
            systemLogger.error("[Send Email API] Failed to parse request body:", e);
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        const { submissionId, to, subject, body: emailBody, includePdf } = body;

        if (!submissionId || !to || !subject || !emailBody) {
            return NextResponse.json({ error: "Missing required fields (submissionId, to, subject, body)" }, { status: 400 });
        }

        const submission = await (prismadb as any).formSubmission.findUnique({
            where: { id: submissionId },
            include: { form: true }
        });
        if (!submission) {
            return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        }

        const resourceTeamId = submission.team_id || submission.form?.team_id || null;
        if (!validateResourceOwnership(teamInfo!.teamId, resourceTeamId, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const attachments = [];
        if (includePdf && submission) {
            const pdfBuffer = await generateSubmissionPdf(submission);
            attachments.push({
                filename: `submission-${submissionId}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf"
            });
        }

        const safeHtmlBody = escapeHtml(emailBody);

        // Send the email
        await sendEmail({
            to,
            from: process.env.EMAIL_FROM,
            subject,
            text: emailBody,
            html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="white-space: pre-wrap;">${safeHtmlBody}</div>
                <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
                <p style="font-size: 12px; color: #888;">Sent from BasaltCRM</p>
            </div>`,
            attachments
        });

        systemLogger.error("[Send Email API] Process completed successfully");
        return NextResponse.json({ success: true, message: "Email sent" });
    } catch (error: any) {
        systemLogger.error("[Send Email API] Critical Error:", error);
        return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
    }
}
