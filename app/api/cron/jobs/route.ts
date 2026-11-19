import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getTeamCronJobs,
  registerCronJob,
  countActiveJobs,
} from "@/lib/cron-scheduler";
import { prismadb } from "@/lib/prisma";

// ─── GET: List cron jobs for the current team ────────────────────────────────

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prismadb.users.findUnique({
      where: { id: (session.user as any).id },
      select: { id: true, team_id: true, is_admin: true },
    });

    if (!user?.team_id) {
      return NextResponse.json({ error: "No team" }, { status: 400 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const jobType = url.searchParams.get("type") || undefined;

    const jobs = await getTeamCronJobs(user.team_id, {
      status,
      jobType,
      // Non-admins only see their own jobs
      userId: user.is_admin ? undefined : user.id,
    });

    const activeCount = await countActiveJobs(user.team_id);

    return NextResponse.json({ jobs, activeCount });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to fetch cron jobs" },
      { status: 500 }
    );
  }
}

// ─── POST: Create a new cron job ─────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prismadb.users.findUnique({
      where: { id: (session.user as any).id },
      select: { id: true, team_id: true },
    });

    if (!user?.team_id) {
      return NextResponse.json({ error: "No team" }, { status: 400 });
    }

    const body = await req.json();
    const {
      jobType,
      label,
      campaignId,
      intervalMs,
      cronExpression,
      maxRuns,
      expiresAt,
    } = body;

    if (!jobType) {
      return NextResponse.json(
        { error: "jobType is required" },
        { status: 400 }
      );
    }

    if (campaignId) {
      const campaign = await prismadb.crm_Outreach_Campaigns.findUnique({
        where: { id: String(campaignId) },
        select: { id: true, team_id: true },
      });
      if (!campaign || campaign.team_id !== user.team_id) {
        return NextResponse.json(
          { error: "Forbidden — campaign does not belong to your team" },
          { status: 403 }
        );
      }
    }

    // Future: enforce per-team limits here
    // const activeCount = await countActiveJobs(user.team_id);
    // const limit = await getTeamCronLimit(user.team_id);
    // if (activeCount >= limit) return NextResponse.json({ error: "Cron job limit reached" }, { status: 429 });

    const job = await registerCronJob({
      teamId: user.team_id,
      userId: user.id,
      jobType,
      label,
      campaignId,
      intervalMs: intervalMs || undefined,
      cronExpression: cronExpression || undefined,
      maxRuns: maxRuns || undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json({ job });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to create cron job" },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update job status (pause/resume/cancel) ──────────────────────────

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prismadb.users.findUnique({
      where: { id: (session.user as any).id },
      select: { id: true, team_id: true, is_admin: true },
    });

    if (!user?.team_id) {
      return NextResponse.json({ error: "No team" }, { status: 400 });
    }

    const body = await req.json();
    const { jobId, action, intervalMs } = body;

    if (!jobId || !action) {
      return NextResponse.json(
        { error: "jobId and action required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const job = await prismadb.crm_Cron_Jobs.findUnique({
      where: { id: jobId },
    });

    if (!job || job.team_id !== user.team_id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Non-admins can only modify their own jobs
    if (!user.is_admin && job.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: any = {};

    switch (action) {
      case "pause":
        updateData.status = "PAUSED";
        break;
      case "resume":
        updateData.status = "ACTIVE";
        updateData.next_run_at = new Date(
          Date.now() + (job.interval_ms || 3600000)
        );
        updateData.error_count = 0; // Reset error count on resume
        break;
      case "cancel":
        updateData.status = "COMPLETED";
        break;
      case "update_interval":
        if (intervalMs && intervalMs >= 60000) {
          updateData.interval_ms = intervalMs;
          updateData.next_run_at = new Date(Date.now() + intervalMs);
        }
        break;
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const updated = await prismadb.crm_Cron_Jobs.update({
      where: { id: jobId },
      data: updateData,
    });

    return NextResponse.json({ job: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update cron job" },
      { status: 500 }
    );
  }
}
