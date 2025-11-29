import { prismadb } from "@/lib/prisma";

export type PipelineStage = "Identify" | "Engage_AI" | "Engage_Human" | "Offering" | "Finalizing" | "Closed";

export const STAGES: PipelineStage[] = [
  "Identify",
  "Engage_AI",
  "Engage_Human",
  "Offering",
  "Finalizing",
  "Closed",
];

// Gamified weights for highest stage reached
export const STAGE_WEIGHTS: Record<PipelineStage, number> = {
  Identify: 0,
  Engage_AI: 10,
  Engage_Human: 20,
  Offering: 40,
  Finalizing: 60,
  Closed: 100,
};

export type LeadTouchMetrics = {
  emailSent: number;
  callsInitiated: number;
  touches: number; // email + calls
  daysToBooking?: number; // if outreach_meeting_booked_at and outreach_sent_at are available
};

export type UserLeaderboardEntry = {
  userId: string;
  name: string | null;
  email: string;
  avatar?: string | null;
  color?: string; // optional persistent color if needed
  points: number;
  breakdown: {
    basePoints: number;
    efficiencyBonusPoints: number; // derived from multiplier effect
    speedBonusPoints: number; // derived from multiplier effect
  };
  stageCounts: Record<PipelineStage, number>;
  closedCount: number;
  achievements: { id: string; title: string; description: string; earnedAt?: string }[];
};

export type TeamOverview = {
  totalLeads: number;
  stageCounts: Record<PipelineStage, number>;
  activityCounts: {
    emailsPresent: number;
    phonesPresent: number;
    emailSent: number; // across team
    callsInitiated: number; // across team
  };
};

export type TeamAnalytics = {
  team: TeamOverview;
  leaderboard: UserLeaderboardEntry[];
  weights: Record<PipelineStage, number>;
};

function clamp(min: number, val: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

async function getLeadTouchMetrics(leadId: string, userId: string): Promise<LeadTouchMetrics> {
  // Activity counts scoped to this user & lead
  const emailSent = await prismadb.crm_Lead_Activities.count({
    where: { user: userId, type: "email_sent", lead: leadId as any },
  });
  const callsInitiated = await prismadb.crm_Lead_Activities.count({
    where: { user: userId, type: { contains: "call", mode: "insensitive" }, lead: leadId as any },
  });
  const touches = emailSent + callsInitiated;

  // Days to booking (proxy for speed to meaningful engagement/close)
  const lead = await prismadb.crm_Leads.findUnique({
    where: { id: leadId },
    select: { outreach_sent_at: true, outreach_meeting_booked_at: true },
  });
  let daysToBooking: number | undefined = undefined;
  if (lead?.outreach_sent_at && lead?.outreach_meeting_booked_at) {
    const ms = new Date(lead.outreach_meeting_booked_at).getTime() - new Date(lead.outreach_sent_at).getTime();
    daysToBooking = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  }

  return { emailSent, callsInitiated, touches, daysToBooking };
}

function computeLeadPoints(stage: PipelineStage, metrics: LeadTouchMetrics): { points: number; basePoints: number; effBonusPoints: number; speedBonusPoints: number } {
  const base = STAGE_WEIGHTS[stage] || 0;
  let efficiencyMultiplier = 1;
  let speedMultiplier = 1;

  // Efficiency bonus: reward closing with fewer touches
  // Applied only when stage is Closed
  if (stage === "Closed") {
    const touches = metrics.touches;
    // Up to +30% bonus for <=3 touches, decreasing with more touches
    const effBonus = clamp(0, (3 - touches) / 10, 0.3); // 0..0.3
    efficiencyMultiplier = 1 + effBonus;

    // Speed bonus: reward faster movement to meeting booking
    if (typeof metrics.daysToBooking === "number") {
      // Up to +70% bonus when booking within 0–14 days, decreasing linearly
      const speedBonus = clamp(0, (14 - metrics.daysToBooking) / 20, 0.7); // 0..0.7
      speedMultiplier = 1 + speedBonus;
    }
  }

  const total = Math.round(base * efficiencyMultiplier * speedMultiplier);
  const effBonusPoints = Math.round(base * (efficiencyMultiplier - 1));
  const speedBonusPoints = Math.round(base * (speedMultiplier - 1));

  return { points: total, basePoints: base, effBonusPoints, speedBonusPoints };
}

function zeroStages(): Record<PipelineStage, number> {
  return {
    Identify: 0,
    Engage_AI: 0,
    Engage_Human: 0,
    Offering: 0,
    Finalizing: 0,
    Closed: 0,
  };
}

function stageOrder(s: PipelineStage): number {
  return STAGES.indexOf(s);
}

export async function getTeamAnalytics(): Promise<TeamAnalytics> {
  // Active team members
  const users = await prismadb.users.findMany({
    where: { userStatus: "ACTIVE" as any },
    select: { id: true, name: true, email: true, avatar: true },
    orderBy: { name: "asc" },
  });

  // Pre-fetch all leads to build team overview
  const allLeads = await prismadb.crm_Leads.findMany({
    select: {
      id: true,
      assigned_to: true,
      email: true,
      phone: true,
      pipeline_stage: true,
      outreach_sent_at: true,
      outreach_meeting_booked_at: true,
    },
  });

  // Team overview stage counts
  const teamStageCounts = zeroStages();
  for (const l of allLeads as any[]) {
    const s: PipelineStage = (l.pipeline_stage as PipelineStage) || "Identify";
    if (teamStageCounts[s] !== undefined) teamStageCounts[s]++;
  }

  // Team activity counts across all users/leads
  const emailsPresent = (allLeads as any[]).filter((l) => !!l.email && String(l.email).trim().length > 0).length;
  const phonesPresent = (allLeads as any[]).filter((l) => !!l.phone && String(l.phone).trim().length > 0).length;

  const emailSentTeam = await prismadb.crm_Lead_Activities.count({ where: { type: "email_sent" } });
  const callsInitiatedTeam = await prismadb.crm_Lead_Activities.count({
    where: { type: { contains: "call", mode: "insensitive" } },
  });

  const team: TeamOverview = {
    totalLeads: allLeads.length,
    stageCounts: teamStageCounts,
    activityCounts: {
      emailsPresent,
      phonesPresent,
      emailSent: emailSentTeam,
      callsInitiated: callsInitiatedTeam,
    },
  };

  const leaderboard: UserLeaderboardEntry[] = [];

  // Build per-user leaderboard entries
  for (const u of users) {
    const myLeads = (allLeads as any[]).filter((l) => (l.assigned_to as string | null) === u.id);

    const byStage = zeroStages();
    let basePoints = 0;
    let effBonusPoints = 0;
    let speedBonusPoints = 0;
    let totalPoints = 0;
    let closedCount = 0;

    for (const l of myLeads) {
      const s: PipelineStage = (l.pipeline_stage as PipelineStage) || "Identify";
      if (byStage[s] !== undefined) byStage[s]++;
      const metrics = await getLeadTouchMetrics(l.id, u.id);
      const p = computeLeadPoints(s, metrics);
      basePoints += p.basePoints;
      effBonusPoints += p.effBonusPoints;
      speedBonusPoints += p.speedBonusPoints;
      totalPoints += p.points;
      if (s === "Closed") closedCount++;
    }

    // Achievements detection
    const achievements: { id: string; title: string; description: string; earnedAt?: string }[] = [];

    // Helper counts for achievements
    const engageAIOrMore = STAGES.filter((s) => s !== "Identify")
      .map((s) => byStage[s])
      .reduce((a, b) => a + b, 0);
    const engageHumanOrMore = STAGES.filter((s) => stageOrder(s) >= stageOrder("Engage_Human"))
      .map((s) => byStage[s])
      .reduce((a, b) => a + b, 0);

    if (engageAIOrMore >= 10) {
      achievements.push({ id: "ten-ai-engagements", title: "Momentum Builder", description: "Moved 10+ leads past Identify." });
    }
    if (engageHumanOrMore >= 5) {
      achievements.push({ id: "human-whisperer", title: "Human Whisperer", description: "Advanced 5+ leads to Engage Human or beyond." });
    }
    if (byStage.Offering >= 5) {
      achievements.push({ id: "offer-maker", title: "Offer Maker", description: "Brought 5+ leads to Offering stage." });
    }
    if (closedCount >= 5) {
      achievements.push({ id: "closer-5", title: "Closer x5", description: "Closed 5+ leads." });
    }

    // Speedster and Sniper require per-lead metrics; recompute quickly
    let speedsterCount = 0;
    let sniperCount = 0;
    for (const l of myLeads) {
      const s: PipelineStage = (l.pipeline_stage as PipelineStage) || "Identify";
      if (s !== "Closed") continue;
      const m = await getLeadTouchMetrics(l.id, u.id);
      if (typeof m.daysToBooking === "number" && m.daysToBooking <= 7) speedsterCount++;
      if (m.touches <= 3) sniperCount++;
    }
    if (speedsterCount >= 3) {
      achievements.push({ id: "speedster", title: "Speedster", description: "Closed 3+ leads within 7 days of outreach." });
    }
    if (sniperCount >= 3) {
      achievements.push({ id: "sniper", title: "Sniper", description: "Closed 3+ leads with 3 or fewer touches." });
    }

    leaderboard.push({
      userId: u.id,
      name: u.name || null,
      email: u.email,
      avatar: u.avatar || null,
      points: totalPoints,
      breakdown: { basePoints, efficiencyBonusPoints: effBonusPoints, speedBonusPoints },
      stageCounts: byStage,
      closedCount,
      achievements,
    });
  }

  // Sort leaderboard by points descending
  leaderboard.sort((a, b) => b.points - a.points);

  return {
    team,
    leaderboard,
    weights: STAGE_WEIGHTS,
  };
}
