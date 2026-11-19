import { NextResponse } from "next/server";
import { prismadbCrm } from "@/lib/prisma-crm";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { systemLogger } from "@/lib/logger";

type EmailBlastRequest = {
  selectedContactIds: string[];
  subject: string;
  body: string; // may include placeholders like {fullName}, {companyName}, {title}
};

type PreparedEmail = {
  contactId: string;
  to: string;
  subject: string;
  body: string;
  meta: {
    fullName?: string;
    title?: string;
    companyName?: string;
    domain?: string;
  };
};

/**
 * POST /api/crm/leads/pools/[poolId]/email-blast
 * Prepares an email blast for selected contacts in the pool.
 * Returns prepared emails (no sending here; integrate with your email sending flow).
 */
type Params = { params: Promise<{ poolId: string }> };
export async function POST(
  req: Request,
  { params }: Params
) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const { poolId } = await params;
  if (!poolId) {
    return new NextResponse("Missing poolId", { status: 400 });
  }

  let payload: EmailBlastRequest;
  try {
    payload = await req.json();
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (!Array.isArray(payload.selectedContactIds) || payload.selectedContactIds.length === 0) {
    return new NextResponse("No contacts selected", { status: 400 });
  }
  if (!payload.subject?.trim() || !payload.body?.trim()) {
    return new NextResponse("Subject and body are required", { status: 400 });
  }

  try {
    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { id: true, user: true, team_id: true, assigned_members: true },
    });
    if (!pool) {
      return new NextResponse("Pool not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    const isAssigned = Array.isArray(pool.assigned_members) && pool.assigned_members.includes(session!.user.id);
    if (!teamInfo!.isPlatformAdmin && !teamInfo!.isAdmin && pool.user !== session!.user.id && !isAssigned) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Fetch candidates for the pool to build a map of candidateId -> company data
    const candidates = await (prismadbCrm as any).crm_Lead_Candidates.findMany({
      where: { pool: poolId },
      select: {
        id: true,
        companyName: true,
        domain: true,
      },
    });
    const candidateMeta = new Map<string, { companyName?: string; domain?: string }>();
    for (const c of candidates) {
      candidateMeta.set(c.id, { companyName: c.companyName, domain: c.domain });
    }

    const poolCandidateIds = Array.from(candidateMeta.keys());
    if (poolCandidateIds.length === 0) {
      return NextResponse.json({ preparedCount: 0, prepared: [] }, { status: 200 });
    }

    // Fetch contacts strictly scoped to both selected IDs AND this pool's candidates
    const contacts = await (prismadbCrm as any).crm_Contact_Candidates.findMany({
      where: {
        id: { in: payload.selectedContactIds },
        leadCandidate: { in: poolCandidateIds },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        title: true,
        leadCandidate: true,
      },
    });

    const templateReplace = (tpl: string, meta: Record<string, string | undefined>) => {
      return tpl
        .replace(/\{fullName\}/g, meta.fullName || "")
        .replace(/\{title\}/g, meta.title || "")
        .replace(/\{companyName\}/g, meta.companyName || "")
        .replace(/\{domain\}/g, meta.domain || "");
    };

    const prepared: PreparedEmail[] = contacts
      .filter((c: any) => !!c.email)
      .map((c: any) => {
        const metaBase = candidateMeta.get(c.leadCandidate) || {};
        const meta = {
          fullName: c.fullName || "",
          title: c.title || "",
          companyName: metaBase.companyName || "",
          domain: metaBase.domain || "",
        };
        return {
          contactId: c.id,
          to: c.email,
          subject: templateReplace(payload.subject, meta),
          body: templateReplace(payload.body, meta),
          meta,
        };
      });

    return NextResponse.json(
      {
        preparedCount: prepared.length,
        prepared,
      },
      { status: 200 }
    );
  } catch (error) {
    systemLogger.error("[LEADS_POOL_EMAIL_BLAST_POST]", error);
    return new NextResponse("Failed to prepare email blast", { status: 500 });
  }
}
