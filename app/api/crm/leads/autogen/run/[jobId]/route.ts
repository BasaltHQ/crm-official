import { NextResponse } from "next/server";
import { runLeadGenPipeline } from "@/actions/leads/run-pipeline";
import { prismadbCrm } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/crm/leads/autogen/run/[jobId]
 * Executes the lead generation pipeline in a background promise.
 * Returns 200 OK immediately to avoid timeouts on Vercel/Plesk.
 */
export async function POST(
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
    const job = await (prismadbCrm as any).crm_Lead_Gen_Jobs.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        user: true,
        assigned_pool: { select: { team_id: true } },
      },
    });
    if (!job) {
      return new NextResponse("Job not found", { status: 404 });
    }

    const canRun =
      teamInfo!.isPlatformAdmin ||
      job.user === session!.user.id ||
      (teamInfo!.isAdmin &&
        validateResourceOwnership(teamInfo!.teamId, job.assigned_pool?.team_id || null, false));

    if (!canRun) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // First, mark as running
    await (prismadbCrm as any).crm_Lead_Gen_Jobs.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        logs: [
          { ts: new Date().toISOString(), msg: "Job picked up by background worker." }
        ]
      }
    });

    runLeadGenPipeline({
      jobId,
      userId: session!.user.id,
    }).catch(async (error) => {
      systemLogger.error(`[BACKGROUND_JOB_ERROR] Pipeline failed for job ${jobId}:`, error);
      try {
        await (prismadbCrm as any).crm_Lead_Gen_Jobs.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            logs: [
              { ts: new Date().toISOString(), level: "ERROR", msg: `Background Error: ${error?.message || String(error)}` }
            ]
          }
        });
      } catch (dbErr) {
        console.error("Failed to update job status to FAILED", dbErr);
      }
    });

    return NextResponse.json(
      { ok: true, message: "Job successfully queued for background processing." },
      { status: 200 }
    );
  } catch (error) {
    systemLogger.error("[LEADS_AUTOGEN_RUN_POST]", error);
    return new NextResponse("Failed to run pipeline", { status: 500 });
  }
}
