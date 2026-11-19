"use server";

import { prismadbCrm } from "@/lib/prisma-crm";
import { consumeLeadGenCredits } from "@/lib/scraper/credits";
import { visitWebsiteForAgent, executeToolCall } from "@/lib/scraper/agentic-scraper";
import { getSessionAndTeam } from "@/lib/api-utils";
import { assertSafeExternalUrl } from "@/lib/security/ssrf-guard";

export async function manualAgentEnrichment(
  candidateId: string,
  _callerUserId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error || !session?.user?.id || !teamInfo) {
    return { success: false, message: "Unauthorized." };
  }

  const effectiveUserId = session.user.id;
  const teamId = teamInfo.teamId;
  const isPlatformAdmin = Boolean(teamInfo.isPlatformAdmin);

  if (!teamId && !isPlatformAdmin) {
    return { success: false, message: "User has no team association." };
  }

  const db: any = prismadbCrm;

  // 1. Fetch Candidate
  const candidate = await db.crm_Lead_Candidates.findUnique({
    where: { id: candidateId }
  });

  if (!candidate || !candidate.domain) {
    return { success: false, message: "Candidate or domain not found." };
  }

  // 2. Fetch and verify Pool ownership before charging credits or scraping
  const pool = await db.crm_Lead_Pools.findUnique({
    where: { id: candidate.pool },
    select: { id: true, icpConfig: true, team_id: true }
  });

  if (!pool) {
    return { success: false, message: "Lead pool not found." };
  }

  if (!isPlatformAdmin && (!teamId || pool.team_id !== teamId)) {
    return { success: false, message: "Forbidden: You do not have access to this lead pool." };
  }

  const url = /^https?:\/\//i.test(candidate.domain)
    ? candidate.domain
    : `https://${candidate.domain}`;
  try {
    await assertSafeExternalUrl(url);
  } catch {
    return { success: false, message: "Invalid or disallowed candidate domain." };
  }

  // 3. Consume Credits
  // We explicitly charge 5 credits for this deep manual search
  if (!isPlatformAdmin && teamId) {
    try {
      await consumeLeadGenCredits(teamId, 5);
    } catch (e: any) {
      return { success: false, message: e.message || "Insufficient AI Credits for deep research." };
    }
  }

  try {
    // 4. Scrape Data using Agentic Engine
    const icp = pool?.icpConfig || {};

    const siteData = await visitWebsiteForAgent(url, effectiveUserId, icp);

    if (siteData.error) {
      throw new Error(siteData.error);
    }

    // 5. Build Save Args and Execute
    // The "save_company" hook will natively run enrichCompanyDataWithAI to summarize description
    const saveArgs = {
      domain: candidate.domain,
      companyName: candidate.companyName || siteData.title || candidate.domain,
      description: siteData.description || "",
      industry: candidate.industry || "",
      techStack: siteData.techStack || [],
      contacts: siteData.contacts || [],
    };

    const context = {
      jobId: "MANUAL_ENRICHMENT",
      poolId: candidate.pool,
      userId: effectiveUserId,
      icp: icp,
      logs: [] // don't track background logs since there is no running job
    };

    const saveResult = await executeToolCall("save_company", saveArgs, context);

    if (!saveResult.success) {
      throw new Error(saveResult.error || "Failed to save deep research data. This might be a blocklisted directory.");
    }

    return { 
      success: true, 
      message: `Enrichment complete. Successfully charged 5 LeadGen Credits.`,
      data: {
         contactsCreated: saveResult.contactsCreated || 0,
      }
    };
  } catch (error: any) {
    // Note: If you wanted, you could refund the credits here if it completely fails.
    console.error("[Manual Enrichment Error]", error);
    return { success: false, message: error.message || "An unexpected error occurred during deep enrichment." };
  }
}
