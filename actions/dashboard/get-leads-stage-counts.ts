import { prismadb } from "@/lib/prisma";

export type PipelineStage =
  | "Identify"
  | "Engage_AI"
  | "Engage_Human"
  | "Offering"
  | "Finalizing"
  | "Closed";

export type StageCounts = {
  total: number;
  byStage: Record<PipelineStage, number>;
};

export type ActivityMetrics = {
  emailsPresent: number; // leads with an email
  phonesPresent: number; // leads with a phone
  emailSent: number;     // crm_Lead_Activities(type = 'email_sent') scoped to user/leads
  callsInitiated: number; // crm_Lead_Activities(type contains 'call') scoped to user/leads
};

export type OverallSummary = {
  counts: StageCounts;
  metrics: ActivityMetrics;
};

export type PoolStageSummary = {
  poolId: string;
  name: string;
  counts: StageCounts;     // total = all leads in pool; Identify = assigned_to count; other stages = pool-wide counts
  metrics: ActivityMetrics; // metrics for user's assigned leads within this pool
  assignedCount: number;   // number of leads in this pool assigned to the user (for filtering in UI)
};

/**
 * Returns stage counts and activity metrics for a given user (assigned_to).
 * Also includes per-pool summaries for only the user's lead pools.
 */
export async function getLeadsStageCounts(userId: string): Promise<{
  overall: OverallSummary;
  pools: PoolStageSummary[];
}> {
  const stages: PipelineStage[] = [
    "Identify",
    "Engage_AI",
    "Engage_Human",
    "Offering",
    "Finalizing",
    "Closed",
  ];

  const zeroStages = (): Record<PipelineStage, number> => ({
    Identify: 0,
    Engage_AI: 0,
    Engage_Human: 0,
    Offering: 0,
    Finalizing: 0,
    Closed: 0,
  });

  // Overall: scoped to leads assigned to the user
  const myLeads = await prismadb.crm_Leads.findMany({ where: { assigned_to: userId } });
  const overallByStage = zeroStages();
  for (const l of myLeads) {
    const stage = (((l as any).pipeline_stage as PipelineStage) || "Identify");
    if (overallByStage[stage] !== undefined) overallByStage[stage]++;
  }
  const overallCounts: StageCounts = { total: myLeads.length, byStage: overallByStage };

  // Overall metrics (only on user's assigned leads)
  const myLeadIds = myLeads.map((l: any) => l.id);
  const emailsPresent = myLeads.filter((l: any) => !!l.email && String(l.email).trim().length > 0).length;
  const phonesPresent = myLeads.filter((l: any) => !!l.phone && String(l.phone).trim().length > 0).length;
  const emailSent = await prismadb.crm_Lead_Activities.count({
    where: { user: userId, type: "email_sent", lead: { in: myLeadIds as any } },
  });
  const callsInitiated = await prismadb.crm_Lead_Activities.count({
    where: { user: userId, type: { contains: "call", mode: "insensitive" }, lead: { in: myLeadIds as any } },
  });
  const overall: OverallSummary = {
    counts: overallCounts,
    metrics: { emailsPresent, phonesPresent, emailSent, callsInitiated },
  };

  // Per-pool summaries (for the user's pools)
  const pools = await prismadb.crm_Lead_Pools.findMany({
    where: { user: userId },
    select: { id: true, name: true },
  });

  const poolSummaries: PoolStageSummary[] = [];
  for (const p of pools) {
    // All leads in pool (denominator)
    const poolLeadMaps = await prismadb.crm_Lead_Pools_Leads.findMany({
      where: { pool: p.id },
      select: { lead: true },
    });
    const poolLeadIds = poolLeadMaps.map((m) => m.lead);
    if (poolLeadIds.length === 0) {
      // No leads in pool at all
      poolSummaries.push({
        poolId: p.id,
        name: p.name,
        counts: { total: 0, byStage: zeroStages() },
        metrics: { emailsPresent: 0, phonesPresent: 0, emailSent: 0, callsInitiated: 0 },
        assignedCount: 0,
      });
      continue;
    }

    // Fetch pool leads
    const poolLeads = await prismadb.crm_Leads.findMany({ where: { id: { in: poolLeadIds as any } } });

    // Stage counts: Identify = assigned_to count, other stages = pool-wide counts
    const byStage = zeroStages();
    let identifyAssigned = 0;
    for (const l of poolLeads) {
      const stage = (((l as any).pipeline_stage as PipelineStage) || "Identify");
      if ((l as any).assigned_to === userId) identifyAssigned++;
      if (stage !== "Identify" && byStage[stage] !== undefined) byStage[stage]++;
    }
    byStage.Identify = identifyAssigned;

    const assignedPoolLeads = poolLeads.filter((l: any) => l.assigned_to === userId);
    const assignedIds = assignedPoolLeads.map((l: any) => l.id);

    // Metrics for user's assigned subset within this pool
    const poolEmailsPresent = assignedPoolLeads.filter((l: any) => !!l.email && String(l.email).trim().length > 0).length;
    const poolPhonesPresent = assignedPoolLeads.filter((l: any) => !!l.phone && String(l.phone).trim().length > 0).length;
    const poolEmailSent = assignedIds.length
      ? await prismadb.crm_Lead_Activities.count({ where: { user: userId, type: "email_sent", lead: { in: assignedIds as any } } })
      : 0;
    const poolCallsInitiated = assignedIds.length
      ? await prismadb.crm_Lead_Activities.count({ where: { user: userId, type: { contains: "call", mode: "insensitive" }, lead: { in: assignedIds as any } } })
      : 0;

    poolSummaries.push({
      poolId: p.id,
      name: p.name,
      counts: { total: poolLeadIds.length, byStage },
      metrics: { emailsPresent: poolEmailsPresent, phonesPresent: poolPhonesPresent, emailSent: poolEmailSent, callsInitiated: poolCallsInitiated },
      assignedCount: identifyAssigned,
    });
  }

  // Only show pools where the user is actually assigned any leads
  const filteredPools = poolSummaries.filter((ps) => ps.assignedCount > 0);

  return { overall, pools: filteredPools };
}
