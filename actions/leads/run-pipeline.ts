import { prismadbCrm } from "@/lib/prisma-crm";
import { runSerpScraperForJob } from "@/lib/scraper/serp";
import { enrichCompaniesForJob } from "@/lib/scraper/company-enrichment";
import { calculateCompanyICPScore } from "@/lib/scraper/icp-scoring";
import { runAgenticLeadGeneration } from "@/lib/scraper/agentic-scraper";
import { enrichPeopleForJob } from "@/lib/scraper/people-enrichment";

/**
 * Lead Generation Pipeline
 * Orchestrates SERP discovery, company enrichment, ToS-safe people enrichment, and ICP scoring.
 * Supports agentic AI mode (autonomous search/analysis/save) and standard mode (SERP + crawlers).
 * Updates job status, counters, and logs with production-grade steps and error handling.
 */
export async function runLeadGenPipeline({
  jobId,
  userId,
}: {
  jobId: string;
  userId: string;
}): Promise<{ createdCandidates: number; createdContacts: number }> {
  const db: any = prismadbCrm;

  // Fetch job
  const job = await db.crm_Lead_Gen_Jobs.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  // Mark RUNNING
  await db.crm_Lead_Gen_Jobs.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  let createdCandidates = 0;
  let createdContacts = 0;
  // Aggregation counters from SERP step
  let uniqueDomains: string[] = [];
  let serpEvents = 0;
  let enrichedCount = 0;
  let enrichmentFailed = 0;

  // Use agentic AI mode by default (most powerful)
  // Only fall back to old SERP scraper if explicitly disabled
  const useOldSerpScraper = job.providers?.agenticAI === false;

  if (!useOldSerpScraper) {
    // Autonomous AI agent mode - AI makes all decisions
    const pool = await db.crm_Lead_Pools.findUnique({
      where: { id: job.pool },
      select: { icpConfig: true }
    });

    const result = await runAgenticLeadGeneration(
      jobId,
      userId,
      pool?.icpConfig as any || {},
      job.pool,
      job.counters?.companiesFound || 100
    );

    // SERP fallback: only run if agentic returned zero companies and SERP is enabled
    let serpAddedCandidates = 0;
    const agentSaved = result.companiesSaved || 0;
    const allowSerpFallback = (job.providers?.serpFallback === true) && (job.providers?.serp !== false) && agentSaved === 0;
    if (allowSerpFallback) {
      // Log fallback
      await db.crm_Lead_Gen_Jobs.update({
        where: { id: jobId },
        data: {
          logs: [
            ...(job.logs || []),
            { ts: new Date().toISOString(), msg: "Agentic found 0 companies; SERP fallback enabled -> running SERP..." }
          ]
        }
      });
      try {
        const serpRes = await runSerpScraperForJob(jobId, userId);
        serpAddedCandidates = serpRes.createdCandidates || 0;
        serpEvents += serpRes.sourceEvents || 0;
        uniqueDomains = Array.from(new Set([...(uniqueDomains || []), ...(serpRes.uniqueDomains || [])]));
      } catch (error) {
        await db.crm_Lead_Gen_Jobs.update({
          where: { id: jobId },
          data: {
            logs: [
              ...(job.logs || []),
              { ts: new Date().toISOString(), level: "ERROR", msg: `SERP fallback failed: ${(error as Error)?.message || String(error)}` }
            ]
          }
        });
      }
    } else {
      // Skip SERP when agentic produced results or SERP is disabled
      await db.crm_Lead_Gen_Jobs.update({
        where: { id: jobId },
        data: {
          logs: [
            ...(job.logs || []),
            { ts: new Date().toISOString(), msg: `Skipping SERP: agenticSaved=${agentSaved}, serpEnabled=${job.providers?.serp !== false}, serpFallback=${job.providers?.serpFallback === true}` }
          ]
        }
      });
    }

    // Optional ToS-safe people enrichment (company site parsing)
    let peopleContactsAdded = 0;
    if (job.providers?.peopleEnrichment !== false) {
      try {
        const pe = await enrichPeopleForJob(jobId, userId);
        peopleContactsAdded = pe.contactsAdded || 0;
      } catch (error) {
        // Log enrichment failure but don't fail the whole job
        await db.crm_Lead_Gen_Jobs.update({
          where: { id: jobId },
          data: {
            logs: [
              ...(job.logs || []),
              { ts: new Date().toISOString(), level: "ERROR", msg: `People enrichment failed: ${(error as Error)?.message || String(error)}` }
            ]
          }
        });
      }
    }

    createdCandidates = result.companiesSaved + serpAddedCandidates;

    // Update counters
    await db.crm_Lead_Gen_Jobs.update({
      where: { id: jobId },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        counters: {
          companiesFound: result.companiesSaved,
          candidatesCreated: result.companiesSaved + serpAddedCandidates,
          contactsCreated: (result.contactsSaved || 0) + (peopleContactsAdded || 0),
          agentIterations: result.iterations,
          sourceEvents: (job.counters?.sourceEvents ?? 0) + serpEvents,
          peopleContactsAdded
        },
        logs: [
          ...(job.logs || []),
          { ts: new Date().toISOString(), msg: `🤖 Agentic AI complete: ${result.companiesSaved} companies, ${result.contactsSaved} contacts` },
          ...(peopleContactsAdded ? [{ ts: new Date().toISOString(), msg: `People enrichment: ${peopleContactsAdded} contacts added` }] : [])
        ]
      }
    });

    return { createdCandidates: result.companiesSaved + serpAddedCandidates, createdContacts: (result.contactsSaved || 0) + (peopleContactsAdded || 0) };
  }

  // Standard pipeline mode
  const serpEnabled = job.providers?.serp !== false;
  if (serpEnabled) {
    try {
      const res = await runSerpScraperForJob(jobId, userId);
      createdCandidates += res.createdCandidates;
      serpEvents += res.sourceEvents;
      uniqueDomains = res.uniqueDomains;
    } catch (error) {
      await db.crm_Lead_Gen_Jobs.update({
        where: { id: jobId },
        data: {
          logs: [
            ...(job.logs ?? []),
            { ts: new Date().toISOString(), level: "ERROR", msg: `SERP scraping failed: ${(error as Error)?.message || String(error)}` },
          ],
        },
      });
    }
  }

  // Run company enrichment when enabled
  const enrichmentEnabled = job.providers?.crawler !== false;
  if (enrichmentEnabled && createdCandidates > 0) {
    try {
      const enrichmentResult = await enrichCompaniesForJob(jobId, 50, userId);
      enrichedCount = enrichmentResult.enriched;
      enrichmentFailed = enrichmentResult.failed;

      await db.crm_Lead_Gen_Jobs.update({
        where: { id: jobId },
        data: {
          logs: [
            ...(job.logs ?? []),
            { ts: new Date().toISOString(), msg: `Company enrichment: ${enrichedCount} enriched, ${enrichmentFailed} failed.` },
          ],
        },
      });
    } catch (error) {
      await db.crm_Lead_Gen_Jobs.update({
        where: { id: jobId },
        data: {
          logs: [
            ...(job.logs ?? []),
            { ts: new Date().toISOString(), level: "ERROR", msg: `Company enrichment failed: ${(error as Error)?.message || String(error)}` },
          ],
        },
      });
    }
  }

  // ToS-safe people enrichment (company site parsing) when enabled
  const peopleEnrichmentEnabled = job.providers?.peopleEnrichment !== false;
  if (peopleEnrichmentEnabled && (createdCandidates > 0)) {
    try {
      const pe = await enrichPeopleForJob(jobId, userId);
      createdContacts += pe.contactsAdded || 0;

      await db.crm_Lead_Gen_Jobs.update({
        where: { id: jobId },
        data: {
          logs: [
            ...(job.logs ?? []),
            { ts: new Date().toISOString(), msg: `People enrichment: ${pe.contactsAdded} contacts added across ${pe.companiesProcessed} companies.` },
          ],
          counters: {
            ...(job.counters ?? {}),
            peopleContactsAdded: (job.counters?.peopleContactsAdded ?? 0) + (pe.contactsAdded || 0),
            peopleCompaniesProcessed: (job.counters?.peopleCompaniesProcessed ?? 0) + (pe.companiesProcessed || 0),
          } as any
        },
      });
    } catch (error) {
      await db.crm_Lead_Gen_Jobs.update({
        where: { id: jobId },
        data: {
          logs: [
            ...(job.logs ?? []),
            { ts: new Date().toISOString(), level: "ERROR", msg: `People enrichment failed: ${(error as Error)?.message || String(error)}` },
          ],
        },
      });
    }
  }

  // Calculate ICP scores for all candidates
  const pool = await db.crm_Lead_Pools.findUnique({
    where: { id: job.pool },
    select: { icpConfig: true }
  });

  if (pool?.icpConfig) {
    const candidates = await db.crm_Lead_Candidates.findMany({
      where: { pool: job.pool },
      select: {
        id: true,
        domain: true,
        companyName: true,
        description: true,
        industry: true,
        techStack: true,
        score: true
      }
    });

    // Update each candidate with ICP score
    for (const candidate of candidates) {
      try {
        const icpScore = calculateCompanyICPScore(candidate as any, pool.icpConfig as any);
        const finalScore = Math.round((icpScore * 0.6) + ((candidate.score || 0) * 0.4)); // 60% ICP, 40% enrichment

        await db.crm_Lead_Candidates.update({
          where: { id: candidate.id },
          data: { score: finalScore }
        });
      } catch (error) {
        console.error(`Failed to score candidate ${candidate.id}:`, error);
      }
    }
  }

  // Update counters and mark SUCCESS
  const updatedCounters = {
    ...(job.counters ?? {}),
    companiesFound: (job.counters?.companiesFound ?? 0) + (uniqueDomains?.length ?? 0),
    candidatesCreated: (job.counters?.candidatesCreated ?? 0) + createdCandidates,
    contactsCreated: (job.counters?.contactsCreated ?? 0) + createdContacts,
    sourceEvents: (job.counters?.sourceEvents ?? 0) + (serpEvents ?? 0),
    companiesEnriched: (job.counters?.companiesEnriched ?? 0) + enrichedCount,
    enrichmentFailed: (job.counters?.enrichmentFailed ?? 0) + enrichmentFailed,
  };

  await db.crm_Lead_Gen_Jobs.update({
    where: { id: jobId },
    data: {
      status: "SUCCESS",
      finishedAt: new Date(),
      counters: updatedCounters,
      logs: [
        ...(job.logs ?? []),
        { ts: new Date().toISOString(), msg: `LeadGen pipeline complete: domains=${uniqueDomains?.length ?? 0}, candidates=${createdCandidates}, enriched=${enrichedCount}, contacts=${createdContacts}, sourceEvents=${serpEvents ?? 0}.` },
      ],
    },
  });

  return { createdCandidates, createdContacts };
}
