import { NextResponse } from "next/server";
import { prismadbCrm } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const { jobId } = await params;
  const body = await req.json();
  const { action } = body;

  if (!["pause", "resume", "stop"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be: pause, resume, or stop" },
      { status: 400 }
    );
  }

  try {
    const db: any = prismadbCrm;

    // Get current job
    const job = await db.crm_Lead_Gen_Jobs.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, user: true, assigned_pool: { select: { team_id: true } } }
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const canControl =
      teamInfo!.isPlatformAdmin ||
      job.user === session!.user.id ||
      (teamInfo!.isAdmin &&
        validateResourceOwnership(teamInfo!.teamId, job.assigned_pool?.team_id || null, false));

    if (!canControl) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Handle different actions
    let newStatus: string;
    let logMsg: string;

    switch (action) {
      case "pause":
        if (job.status !== "RUNNING") {
          return NextResponse.json(
            { error: "Can only pause running jobs" },
            { status: 400 }
          );
        }
        newStatus = "PAUSED";
        logMsg = "⏸️ Job paused by user";
        break;

      case "resume":
        if (job.status !== "PAUSED") {
          return NextResponse.json(
            { error: "Can only resume paused jobs" },
            { status: 400 }
          );
        }
        newStatus = "RUNNING";
        logMsg = "▶️ Job resumed by user";
        break;

      case "stop":
        if (!["RUNNING", "PAUSED", "QUEUED"].includes(job.status)) {
          return NextResponse.json(
            { error: "Can only stop running, paused, or queued jobs" },
            { status: 400 }
          );
        }
        newStatus = "STOPPED";
        logMsg = "⏹️ Job stopped by user";
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Update job status
    const updatedJob = await db.crm_Lead_Gen_Jobs.update({
      where: { id: jobId },
      data: {
        status: newStatus,
        ...(action === "stop" && { finishedAt: new Date() }),
        logs: {
          push: {
            ts: new Date().toISOString(),
            msg: logMsg
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      jobId,
      action,
      newStatus,
      message: logMsg
    });
  } catch (error) {
    systemLogger.error("[CONTROL_JOB]", error);
    return new NextResponse("Failed to control job", { status: 500 });
  }
}
