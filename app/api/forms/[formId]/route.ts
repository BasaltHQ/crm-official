import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { assertSafeExternalUrl } from "@/lib/security/ssrf-guard";
import { encryptSecret, isMaskedSecret, maskFields } from "@/lib/encryption";
import { logActivityInternal } from "@/actions/audit";

// GET - Get single form
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;
        const { error, teamInfo } = await getSessionAndTeam();
        if (error) return error;

        const form = await (prismadb as any).form.findUnique({
            where: { id: formId },
            include: {
                fields: {
                    orderBy: { position: "asc" },
                },
                _count: {
                    select: { submissions: true },
                },
            },
        });

        if (!form) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, form.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json(maskFields(form, ["captcha_secret_key"]));
    } catch (error) {
        console.error("Error fetching form:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// PATCH - Update form
export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error) return error;
        const userId = session!.user.id;

        // Check form exists and belongs to caller's team
        const existingForm = await (prismadb as any).form.findUnique({
            where: { id: formId },
        });

        if (!existingForm) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, existingForm.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const {
            name,
            description,
            status,
            visibility,
            primary_color,
            custom_css,
            success_message,
            redirect_url,
            require_captcha,
            notify_emails,
            webhook_url,
            auto_respond,
            auto_respond_subject,
            auto_respond_body,
            captcha_site_key,
            captcha_secret_key,
            submission_behavior,
        } = body;

        if (webhook_url) {
            try {
                await assertSafeExternalUrl(String(webhook_url));
            } catch (urlErr: any) {
                return NextResponse.json({ error: urlErr?.message || "Invalid webhook_url" }, { status: 400 });
            }
        }

        // Build update data - only include fields that are provided
        const updateData: any = {};

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (visibility !== undefined) updateData.visibility = visibility;
        if (primary_color !== undefined) updateData.primary_color = primary_color;
        if (custom_css !== undefined) updateData.custom_css = custom_css;
        if (success_message !== undefined) updateData.success_message = success_message;
        if (redirect_url !== undefined) updateData.redirect_url = redirect_url;
        if (require_captcha !== undefined) updateData.require_captcha = require_captcha;
        if (notify_emails !== undefined) updateData.notify_emails = notify_emails;
        if (webhook_url !== undefined) updateData.webhook_url = webhook_url;
        if (auto_respond !== undefined) updateData.auto_respond = auto_respond;
        if (auto_respond_subject !== undefined) updateData.auto_respond_subject = auto_respond_subject;
        if (auto_respond_body !== undefined) updateData.auto_respond_body = auto_respond_body;
        if (captcha_site_key !== undefined) updateData.captcha_site_key = captcha_site_key;
        if (captcha_secret_key !== undefined && !isMaskedSecret(captcha_secret_key)) {
            updateData.captcha_secret_key = captcha_secret_key ? encryptSecret(captcha_secret_key) : null;
        }
        if (submission_behavior !== undefined) updateData.submission_behavior = submission_behavior;

        const form = await (prismadb as any).form.update({
            where: { id: formId },
            data: updateData,
            include: {
                fields: {
                    orderBy: { position: "asc" },
                },
            },
        });

        await logActivityInternal(userId, "UPDATE", "Form", `Updated form: ${form.name} (${formId})`, existingForm.team_id || teamInfo!.teamId || undefined);
        return NextResponse.json(maskFields(form, ["captcha_secret_key"]));
    } catch (error) {
        console.error("Error updating form:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE - Delete form
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ formId: string }> }
) {
    try {
        const { formId } = await params;
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error) return error;
        const userId = session!.user.id;

        const existingForm = await (prismadb as any).form.findUnique({
            where: { id: formId },
        });

        if (!existingForm) {
            return NextResponse.json({ error: "Form not found" }, { status: 404 });
        }

        if (!validateResourceOwnership(teamInfo!.teamId, existingForm.team_id, teamInfo!.isPlatformAdmin)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Delete form (fields and submissions will cascade due to schema)
        await (prismadb as any).form.delete({
            where: { id: formId },
        });

        await logActivityInternal(userId, "DELETE", "Form", `Deleted form: ${existingForm.name} (${formId})`, existingForm.team_id || teamInfo!.teamId || undefined);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting form:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
