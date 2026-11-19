import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ formId: string }> }
) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

    try {
        const { formId } = await params;

        if (!formId) {
            return new NextResponse("Form ID is required", { status: 400 });
        }

        const form = await prismadb.form.findUnique({
            where: { id: formId },
            select: { id: true, team_id: true },
        });
        if (!form) {
            return new NextResponse("Form not found", { status: 404 });
        }
        if (!validateResourceOwnership(teamInfo!.teamId, form.team_id, teamInfo!.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Get optional metadata from request
        const body = await req.json().catch(() => ({}));
        const { ip_address, user_agent, referer } = body;

        // Transaction to increment count and create view record
        await prismadb.$transaction([
            prismadb.form.update({
                where: { id: formId },
                data: { view_count: { increment: 1 } }
            }),
            prismadb.formView.create({
                data: {
                    form_id: formId,
                    ip_address: ip_address || null,
                    user_agent: user_agent || null,
                    referer: referer || null
                }
            })
        ]);

        return NextResponse.json({ success: true });

    } catch (error) {
        systemLogger.error("[FORM_VIEW_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
