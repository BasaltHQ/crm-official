import { NextResponse } from "next/server";
import { prismadbCrm } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

/**
 * GET /api/crm/leads/autogen/status/[jobId]
 * Returns status and counters for a lead generation job, plus related pool info.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const { jobId } = await params;
  if (!jobId) {
    return new NextResponse("Missing jobId", { status: 400 });
  }

  try {
    // Fetch job with minimal relations + ownership fields
    const job = await (prismadbCrm as any).crm_Lead_Gen_Jobs.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        user: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        counters: true,
        logs: true,
        pool: true,
        assigned_pool: { select: { id: true, name: true, team_id: true, user: true } },
        sourceEvents: { select: { id: true, type: true, fetchedAt: true } }
      }
    });

    if (!job) {
      return new NextResponse("Job not found", { status: 404 });
    }

    const canAccess =
      teamInfo!.isPlatformAdmin ||
      job.user === session!.user.id ||
      validateResourceOwnership(teamInfo!.teamId, job.assigned_pool?.team_id || null, false);

    if (!canAccess) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Count candidates for the pool
    const candidatesCount = await (prismadbCrm as any).crm_Lead_Candidates.count({
      where: { pool: job.pool },
    });

    return NextResponse.json(
      {
        job: {
          id: job.id,
          status: job.status,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          counters: job.counters ?? {},
          logs: job.logs ?? [],
        },
        pool: job.assigned_pool ?? { id: job.pool },
        sourceEventsCount: Array.isArray(job.sourceEvents)
          ? job.sourceEvents.length
          : 0,
        candidatesCount,
      },
      { status: 200 }
    );
  } catch (error) {
    systemLogger.error("[LEADS_AUTOGEN_STATUS_GET]", error);
    return new NextResponse("Failed to fetch job status", { status: 500 });
  }
}
