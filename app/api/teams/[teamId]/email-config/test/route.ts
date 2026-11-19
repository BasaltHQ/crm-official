import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { escapeHtml } from "@/lib/security/ssrf-guard";
import { sendTeamEmail } from "@/lib/email/team-mailer";

const VALID_PURPOSES = ["GENERAL", "OUTREACH", "INBOUND"] as const;

export async function POST(
    req: Request,
    props: { params: Promise<{ teamId: string }> }
) {
    const params = await props.params;
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, params.teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const { to, purpose } = await req.json();
        if (!to || typeof to !== "string") {
            return NextResponse.json({ error: "Recipient email required" }, { status: 400 });
        }

        const candidatePurpose = String(purpose || "GENERAL").toUpperCase();
        if (!VALID_PURPOSES.includes(candidatePurpose as any)) {
            return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
        }
        const emailPurpose = candidatePurpose as "GENERAL" | "OUTREACH" | "INBOUND";

        await sendTeamEmail(
            params.teamId,
            {
                to: to.trim(),
                subject: `BasaltCRM Test Email (${emailPurpose})`,
                text: `This is a test email from your BasaltCRM ${emailPurpose.toLowerCase()} email configuration.`,
                html: `<h1>BasaltCRM Test Email</h1><p>Congratulations! Your <strong>${escapeHtml(emailPurpose)}</strong> email configuration is working correctly.</p><p>Sent via BasaltCRM Team Mailer.</p>`,
            },
            emailPurpose
        );

        return NextResponse.json({ success: true, message: "Test email sent successfully" });
    } catch (error: any) {
        console.error("Test email failed:", error);
        return NextResponse.json({ success: false, error: "Test email failed" }, { status: 500 });
    }
}
