import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";
import { safeContactDisplayName, normalizeName } from "@/lib/scraper/normalize";

/**
 * POST /api/leads/pools/[poolId]/assign
 * Assigns selected candidates to team members by converting them to Leads
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { poolId } = await params;
    const body = await req.json();
    const { assignments } = body; // Array of { candidateId, userId }

    if (!assignments || !Array.isArray(assignments)) {
      return new NextResponse("Invalid assignments data", { status: 400 });
    }

    // Check if user is admin (primary DB flags)
    const userFlags = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { is_admin: true, is_account_admin: true }
    });
    const isAdmin = !!(userFlags?.is_admin || userFlags?.is_account_admin);

    // Verify pool ownership or admin access
    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { user: true }
    });

    if (!pool) {
      return new NextResponse("Pool not found", { status: 404 });
    }

    // Only pool owner or admin can assign leads from this pool
    if (pool.user !== session.user.id && !isAdmin) {
      return new NextResponse("You don't have permission to assign leads from this pool", { status: 403 });
    }

    // Validate assignments: non-admins can only assign to themselves
    if (!isAdmin) {
      const invalidAssignments = assignments.filter((a: any) => a.userId !== session.user.id);
      if (invalidAssignments.length > 0) {
        return new NextResponse("You can only assign leads to yourself. Only admins can assign to other users.", { status: 403 });
      }
    }

    const results = [];

    for (const assignment of assignments) {
      const { candidateId, userId } = assignment;

      // Get the candidate with contacts
      const candidate = await (prismadbCrm as any).crm_Lead_Candidates.findUnique({
        where: { id: candidateId },
        include: {
          contacts: true,
        },
      });

      if (!candidate) {
        continue;
      }

      // Create a Lead for each contact in the candidate
      for (const contact of candidate.contacts) {
        // Check if lead already exists via mapping
        const existing = await (prismadbCrm as any).crm_Contact_Candidate_Leads.findFirst({
          where: { candidate: contact.id },
        });

        if (existing) {
          // Update assignment if needed
          await (prismadbCrm as any).crm_Leads.update({
            where: { id: existing.lead },
            data: { assigned_to: userId },
          });
          continue;
        }

        // Compute a safe person/company display name and split into first/last safely
        const displayName = safeContactDisplayName(
          contact.fullName,
          contact.email,
          candidate.companyName,
          candidate.domain || candidate.homepageUrl
        );
        const normalized = normalizeName(displayName) || displayName;
        const parts = normalized.split(" ").filter(Boolean);
        const computedFirstName = parts.length >= 2 ? parts[0] : "";
        const computedLastName = parts.length >= 2 ? parts.slice(1).join(" ") : (normalized || "Unknown");

        // Create new Lead
        const lead = await (prismadbCrm as any).crm_Leads.create({
          data: {
            firstName: computedFirstName,
            lastName: computedLastName,
            company: candidate.companyName || "",
            email: contact.email || "",
            phone: contact.phone || "",
            description: candidate.description || "",
            status: "NEW",
            assigned_to: userId,
            createdBy: session.user.id,
          },
        });

        // Create mapping
        await (prismadbCrm as any).crm_Contact_Candidate_Leads.create({
          data: {
            candidate: contact.id,
            lead: lead.id,
          },
        });

        // Create pool-lead mapping
        await (prismadbCrm as any).crm_Lead_Pools_Leads.create({
          data: {
            pool: poolId,
            lead: lead.id,
          },
        });

        results.push({ candidateId, contactId: contact.id, leadId: lead.id });
      }

      // Update candidate status
      await (prismadbCrm as any).crm_Lead_Candidates.update({
        where: { id: candidateId },
        data: { status: "CONVERTED" },
      });
    }

    return NextResponse.json({
      success: true,
      assigned: results.length,
      results
    }, { status: 200 });
  } catch (error) {
    console.error("[LEADS_POOL_ASSIGN]", error);
    return new NextResponse("Failed to assign candidates", { status: 500 });
  }
}
