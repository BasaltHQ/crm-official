import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const teamInfo = await getCurrentUserTeamId();
        const resolvedParams = await params;

        const job = await (prismadb as any).crm_Transform_Jobs.findUnique({
            where: { id: resolvedParams.id }
        });

        if (!job || !job.resultData) {
            return new NextResponse("Job data not found", { status: 404 });
        }

        const isOwner =
            Boolean(teamInfo?.isPlatformAdmin) ||
            (job.teamId && teamInfo?.teamId && job.teamId === teamInfo.teamId) ||
            (!job.teamId && job.userId && job.userId === session.user.id);

        if (!isOwner) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const data = job.resultData as any;
        const buffer = Buffer.from(data.base64, "base64");

        const safeBaseName = String(data.fileName || job.fileName || "output")
            .replace(/\.[^/.]+$/, "")
            .replace(/\.\./g, "")
            .replace(/["'\r\n\\/]/g, "")
            .replace(/[^a-zA-Z0-9._ -]/g, "_")
            .trim() || "output";
        const safeExt = String(data.extension || "")
            .replace(/\.\./g, "")
            .replace(/[^a-zA-Z0-9.]/g, "");

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": data.mimeType || "application/octet-stream",
                "X-Content-Type-Options": "nosniff",
                "Content-Disposition": `attachment; filename="${safeBaseName}_extracted${safeExt}"`,
            },
        });
    } catch (error: any) {
        console.error("[JOB_DOWNLOAD_ERROR]", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
