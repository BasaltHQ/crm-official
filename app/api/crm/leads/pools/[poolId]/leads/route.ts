import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { prismadbCrm } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

export async function GET(req: Request, context: { params: Promise<{ poolId: string }> }) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { poolId } = await context.params;
    if (!poolId) return new NextResponse("Missing poolId", { status: 400 });

    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine") === "true";

    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true, team_id: true, assigned_members: true },
    });

    if (!pool) return new NextResponse("Pool not found", { status: 404 });

    if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const isOwner = pool.user === session!.user.id;
    const isAssigned = Array.isArray(pool.assigned_members) && pool.assigned_members.includes(session!.user.id);

    if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && !isOwner && !isAssigned) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Get lead ids linked to this pool through crm_Lead_Pools_Leads
    const poolLeads = await (prismadbCrm as any).crm_Lead_Pools_Leads.findMany({
      where: { pool: poolId },
      select: { lead: true },
    });
    const leadIds = poolLeads.map((pl: any) => pl.lead);

    const targetTeamId = pool.team_id || teamInfo!.teamId;

    // Fetch leads from primary DB strictly scoped to pool's tenant
    const leads = await prismadb.crm_Leads.findMany({
      where: {
        id: { in: leadIds },
        ...(targetTeamId ? { team_id: targetTeamId } : {}),
        ...(mine ? { assigned_to: session!.user.id } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        company: true,
        jobTitle: true,
        email: true,
        phone: true,
        description: true,
        lead_source: true,
        status: true,
        type: true,
        outreach_status: true,
        outreach_sent_at: true,
        outreach_opened_at: true,
        outreach_meeting_booked_at: true,
        outreach_meeting_link: true,
        outreach_notes: true,
        pipeline_stage: true,
        sms_status: true,
        call_status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" as const },
    });

    // Also fetch candidates to show potentially unconverted pool members
    const candidates = await (prismadbCrm as any).crm_Lead_Candidates.findMany({
      where: { pool: poolId },
      include: {
        contacts: {
          orderBy: { confidence: "desc" },
        },
      },
    });

    // Separate candidates
    // A candidate is considered 'converted' if it's explicitly marked OR if it carries an accountsIDs linkage (Common in CSV imports)
    const convertedCandidates = candidates.filter((c: any) => c.status === "CONVERTED" || c.accountsIDs);
    const activeCandidates = candidates.filter((c: any) => !(c.status === "CONVERTED" || c.accountsIDs));

    // Fetch Converted Accounts (strictly scoped to targetTeamId)
    const accountIds = convertedCandidates.map((c: any) => c.accountsIDs).filter(Boolean);
    const convertedAccounts = await (prismadbCrm as any).crm_Accounts.findMany({
      where: {
        id: { in: accountIds },
        ...(targetTeamId ? { team_id: targetTeamId } : {}),
      },
      include: { contacts: true, leads: true }
    });

    const accountItems = [];
    for (const acc of convertedAccounts) {
      const fallbackEmail = acc.email || (acc.additional_emails && acc.additional_emails.length > 0 ? acc.additional_emails[0] : "");

      // Try to find a primary lead record for outreach status
      const primaryLead = acc.leads && acc.leads.length > 0 ? acc.leads[0] : null;

      if (acc.contacts && acc.contacts.length > 0) {
        for (const contact of acc.contacts) {
          accountItems.push({
            id: contact.id,
            accountId: acc.id,
            contactId: contact.id,
            firstName: contact.first_name || "",
            lastName: contact.last_name || "",
            company: acc.name,
            jobTitle: contact.position || contact.job_title || "",
            email: contact.email || fallbackEmail,
            phone: contact.mobile_phone || contact.office_phone || acc.office_phone || "",
            description: acc.description || "",
            lead_source: "POOL_ACCOUNT",
            status: primaryLead?.outreach_status !== "IDLE" ? primaryLead?.outreach_status : (primaryLead?.status || acc.status || "CONVERTED"),
            type: "CLIENT",
            outreach_status: primaryLead?.outreach_status || "IDLE",
            pipeline_stage: primaryLead?.pipeline_stage || acc.type || "Lead",
            createdAt: acc.createdAt,
            updatedAt: acc.updatedAt,
            accountEmail: acc.email || null,
            accountAdditionalEmails: acc.additional_emails || [],
            billing_city: acc.billing_city || null,
            billing_state: acc.billing_state || null,
            billing_country: acc.billing_country || null,
            employees: acc.employees || null,
            annual_revenue: acc.annual_revenue || null,
            vat: acc.vat || null,
          });
        }
      } else {
        // Account with no contacts
        accountItems.push({
          id: acc.id,
          accountId: acc.id,
          contactId: null,
          firstName: "",
          lastName: acc.name,
          company: acc.name,
          jobTitle: "",
          email: fallbackEmail,
          phone: acc.office_phone || "",
          description: acc.description || "",
          lead_source: "POOL_ACCOUNT",
          status: primaryLead?.outreach_status !== "IDLE" ? primaryLead?.outreach_status : (primaryLead?.status || acc.status || "CONVERTED"),
          type: "CLIENT",
          outreach_status: primaryLead?.outreach_status || "IDLE",
          pipeline_stage: primaryLead?.pipeline_stage || acc.type || "Lead",
          createdAt: acc.createdAt,
          updatedAt: acc.updatedAt,
          accountEmail: acc.email || null,
          accountAdditionalEmails: acc.additional_emails || [],
          billing_city: acc.billing_city || null,
          billing_state: acc.billing_state || null,
          billing_country: acc.billing_country || null,
          employees: acc.employees || null,
          annual_revenue: acc.annual_revenue || null,
          vat: acc.vat || null,
        });
      }
    }

    // Build candidate items — one row per CONTACT with email (not per company)
    const candidateItems: any[] = [];
    for (const c of activeCandidates) {
      const allContacts: any[] = c.contacts || [];
      // Filter to contacts that actually have emails
      const contactsWithEmail = allContacts.filter((ct: any) => ct.email && ct.email.trim().length > 0);

      if (contactsWithEmail.length > 0) {
        // Create one row per contact with email
        for (const contact of contactsWithEmail) {
          const nameParts = contact.fullName?.split(" ") || [];
          const lastName = nameParts.length > 1 ? nameParts.pop() : (contact.fullName || "");
          const firstName = nameParts.join(" ");

          candidateItems.push({
            id: `${c.id}_${contact.id}`,
            accountId: c.accountsIDs || null,
            contactId: null,
            firstName: firstName || "",
            lastName: lastName as string || "",
            company: c.companyName || null,
            jobTitle: contact.title || null,
            email: contact.email,
            phone: contact.phone || null,
            description: c.description,
            lead_source: "POOL_CANDIDATE",
            status: c.status || "IDENTIFIED",
            type: "CANDIDATE",
            outreach_status: "IDLE",
            pipeline_stage: "Identify",
            createdAt: c.freshnessAt || new Date(),
            updatedAt: new Date(),
            accountEmail: null,
            accountAdditionalEmails: c.additional_emails || [],
          });
        }
      } else {
        // No contacts with email — show a single row with company info
        // Try the best available contact for name/title
        const bestContact = allContacts[0];
        const nameParts = bestContact?.fullName?.split(" ") || [];
        const lastName = nameParts.length > 1 ? nameParts.pop() : (bestContact?.fullName || c.companyName || "Candidate");
        const firstName = nameParts.join(" ");

        candidateItems.push({
          id: c.id,
          accountId: c.accountsIDs || null,
          contactId: null,
          firstName: firstName || "",
          lastName: lastName as string,
          company: c.companyName || null,
          jobTitle: bestContact?.title || null,
          email: (c.additional_emails && c.additional_emails[0]) || null,
          phone: bestContact?.phone || null,
          description: c.description,
          lead_source: "POOL_CANDIDATE",
          status: c.status || "IDENTIFIED",
          type: "CANDIDATE",
          outreach_status: "IDLE",
          pipeline_stage: "Identify",
          createdAt: c.freshnessAt || new Date(),
          updatedAt: new Date(),
          accountEmail: (c.additional_emails && c.additional_emails[0]) || null,
          accountAdditionalEmails: c.additional_emails?.slice(1) || [],
        });
      }
    }

    // Merge and sort (Legacy Leads + New Account Items + Unconverted Candidates)
    const allLeads = [...leads, ...accountItems, ...candidateItems].sort((a: any, b: any) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });

    return NextResponse.json({ leads: allLeads }, { status: 200 });
  } catch (error) {
    systemLogger.error("[POOL_LEADS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// POST /api/crm/leads/pools/[poolId]/leads
export async function POST(req: Request, context: { params: Promise<{ poolId: string }> }) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { poolId } = await context.params;
    if (!poolId) return new NextResponse("Missing poolId", { status: 400 });

    const body = await req.json();
    const { companyName, firstName, lastName, email, phone, jobTitle } = body;

    if (!lastName && !companyName) {
      return new NextResponse("Name or company is required", { status: 400 });
    }

    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true, team_id: true, assigned_members: true },
    });

    if (!pool) return new NextResponse("Pool not found", { status: 404 });

    if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const isOwner = pool.user === session!.user.id;
    const isAssigned = Array.isArray(pool.assigned_members) && pool.assigned_members.includes(session!.user.id);

    if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && !isOwner && !isAssigned) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Create the candidate (company-level record)
    const candidate = await (prismadbCrm as any).crm_Lead_Candidates.create({
      data: {
        pool: poolId,
        companyName: companyName || `${firstName || ""} ${lastName || ""}`.trim(),
        status: "NEW",
        freshnessAt: new Date(),
        provenance: { source: "manual", addedBy: session!.user.id },
      },
    });

    // Create the contact (person-level record)
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    await (prismadbCrm as any).crm_Contact_Candidates.create({
      data: {
        leadCandidate: candidate.id,
        fullName: fullName || companyName || "Contact",
        email: email || null,
        phone: phone || null,
        title: jobTitle || null,
        confidence: 100,
        status: "NEW",
      },
    });

    return NextResponse.json({ id: candidate.id, message: "Contact added to pool" }, { status: 201 });
  } catch (error) {
    systemLogger.error("[POOL_LEADS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// DELETE /api/crm/leads/pools/[poolId]/leads?leadId=xxx
export async function DELETE(req: Request, context: { params: Promise<{ poolId: string }> }) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    const { poolId } = await context.params;
    if (!poolId) return new NextResponse("Missing poolId", { status: 400 });

    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("leadId");
    if (!leadId) return new NextResponse("Missing leadId", { status: 400 });

    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true, team_id: true, assigned_members: true },
    });

    if (!pool) return new NextResponse("Pool not found", { status: 404 });

    if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const isOwner = pool.user === session!.user.id;
    const isAssigned = Array.isArray(pool.assigned_members) && pool.assigned_members.includes(session!.user.id);

    if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && !isOwner && !isAssigned) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // The leadId can be:
    // 1. A real crm_Leads ID → remove from crm_Lead_Pools_Leads
    // 2. A composite "candidateId_contactId" → remove the candidate
    // 3. An account ID or contact ID from converted candidates

    let removed = false;

    // Strategy 1: Try removing from pool-leads association (legacy crm_Leads)
    try {
      const poolLeadLink = await (prismadbCrm as any).crm_Lead_Pools_Leads.findFirst({
        where: { pool: poolId, lead: leadId },
      });
      systemLogger.info("[POOL_LEADS_DELETE] Strategy 1 (pool-leads link):", { found: !!poolLeadLink });
      if (poolLeadLink) {
        await (prismadbCrm as any).crm_Lead_Pools_Leads.delete({
          where: { id: poolLeadLink.id },
        });
        removed = true;
      }
    } catch (e: any) {
      systemLogger.error("[POOL_LEADS_DELETE] Strategy 1 error:", e?.message);
    }

    // Strategy 2: Try removing candidate directly (composite ID or direct candidate ID)
    if (!removed) {
      const candidateId = leadId.includes("_") ? leadId.split("_")[0] : leadId;
      try {
        const candidate = await (prismadbCrm as any).crm_Lead_Candidates.findFirst({
          where: { id: candidateId, pool: poolId },
        });
        systemLogger.info("[POOL_LEADS_DELETE] Strategy 2 (direct candidate):", { candidateId, found: !!candidate });
        if (candidate) {
          // Must delete child crm_Contact_Candidates first (required relation)
          await (prismadbCrm as any).crm_Contact_Candidates.deleteMany({
            where: { leadCandidate: candidateId },
          });
          await (prismadbCrm as any).crm_Lead_Candidates.delete({
            where: { id: candidateId },
          });
          removed = true;
        }
      } catch (e: any) {
        systemLogger.error("[POOL_LEADS_DELETE] Strategy 2 error:", e?.message);
      }
    }

    // Strategy 3: leadId is a crm_Contacts ID from a converted account
    // Trace: contact ID → accountsIDs → find candidate with that accountsIDs
    if (!removed) {
      try {
        // Look up the contact's parent account (accountsIDs is the FK field)
        const contact = await (prismadbCrm as any).crm_Contacts.findUnique({
          where: { id: leadId },
          select: { accountsIDs: true, account: true },
        });
        systemLogger.info("[POOL_LEADS_DELETE] Strategy 3 (contact lookup):", { contact });
        const accountId = contact?.accountsIDs || contact?.account || null;

        if (accountId) {
          const candidate = await (prismadbCrm as any).crm_Lead_Candidates.findFirst({
            where: { pool: poolId, accountsIDs: accountId },
          });
          systemLogger.info("[POOL_LEADS_DELETE] Strategy 3 (candidate via account):", { accountId, found: !!candidate });
          if (candidate) {
            await (prismadbCrm as any).crm_Contact_Candidates.deleteMany({
              where: { leadCandidate: candidate.id },
            });
            await (prismadbCrm as any).crm_Lead_Candidates.delete({
              where: { id: candidate.id },
            });
            removed = true;
          }
        }
      } catch (e: any) {
        systemLogger.error("[POOL_LEADS_DELETE] Strategy 3 error:", e?.message);
      }
    }

    // Strategy 4: leadId might be an account ID directly (no-contact converted accounts)
    if (!removed) {
      try {
        const candidate = await (prismadbCrm as any).crm_Lead_Candidates.findFirst({
          where: { pool: poolId, accountsIDs: leadId },
        });
        systemLogger.info("[POOL_LEADS_DELETE] Strategy 4 (direct account ID):", { found: !!candidate });
        if (candidate) {
          await (prismadbCrm as any).crm_Contact_Candidates.deleteMany({
            where: { leadCandidate: candidate.id },
          });
          await (prismadbCrm as any).crm_Lead_Candidates.delete({
            where: { id: candidate.id },
          });
          removed = true;
        }
      } catch (e: any) {
        systemLogger.error("[POOL_LEADS_DELETE] Strategy 4 error:", e?.message);
      }
    }

    if (!removed) {
      systemLogger.warn("[POOL_LEADS_DELETE] No match found for leadId:", { leadId, poolId });
      return new NextResponse("Lead not found in this pool", { status: 404 });
    }

    return NextResponse.json({ message: "Removed from pool" }, { status: 200 });
  } catch (error) {
    systemLogger.error("[POOL_LEADS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
