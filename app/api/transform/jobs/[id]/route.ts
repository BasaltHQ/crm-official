import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const teamInfo = await getCurrentUserTeamId();
        const resolvedParams = await params;

        const job = await (prismadb as any).crm_Transform_Jobs.findUnique({
            where: { id: resolvedParams.id }
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        const isOwner =
            Boolean(teamInfo?.isPlatformAdmin) ||
            (job.teamId && teamInfo?.teamId && job.teamId === teamInfo.teamId) ||
            (!job.teamId && job.userId && job.userId === session.user.id);

        if (!isOwner) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Omit resultData to keep polling lightweight
        const { resultData, ...jobMetadata } = job;
        
        return NextResponse.json(jobMetadata);
    } catch (error: any) {
        console.error("[JOB_POLL_ERROR]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
