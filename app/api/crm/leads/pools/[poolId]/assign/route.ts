import { NextResponse } from "next/server";
import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

/**
 * POST /api/crm/leads/pools/[poolId]/assign
 * Assigns selected candidates to team members by converting them to Leads
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  try {
    const { poolId } = await params;
    const body = await req.json();
    const { assignments } = body; // Array of { candidateId, userId }

    if (!assignments || !Array.isArray(assignments)) {
      return new NextResponse("Invalid assignments data", { status: 400 });
    }

    // Verify pool ownership and tenant scope
    const pool = await (prismadbCrm as any).crm_Lead_Pools.findUnique({
      where: { id: poolId },
      select: { id: true, user: true, team_id: true }
    });

    if (!pool) {
      return new NextResponse("Pool not found", { status: 404 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, pool.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Only pool owner or tenant/platform admin can assign leads from this pool
    if (pool.user !== session!.user.id && !teamInfo!.isAdmin && !teamInfo!.isPlatformAdmin) {
      return new NextResponse("You don't have permission to assign leads from this pool", { status: 403 });
    }

    // Validate assignments: non-admins can only assign to themselves
    if (!teamInfo!.isAdmin && !teamInfo!.isPlatformAdmin) {
      const invalidAssignments = assignments.filter((a: any) => a.userId !== session!.user.id);
      if (invalidAssignments.length > 0) {
        return new NextResponse("You can only assign leads to yourself. Only admins can assign to other users.", { status: 403 });
      }
    }

    const targetTeamId = pool.team_id || teamInfo!.teamId;
    if (targetTeamId && !teamInfo!.isPlatformAdmin) {
      const targetUserIds = Array.from(new Set(assignments.map((a: any) => String(a?.userId || "")).filter(Boolean)));
      if (targetUserIds.length > 0) {
        const validMembers = await prismadb.users.count({
          where: { id: { in: targetUserIds }, team_id: targetTeamId },
        });
        if (validMembers !== targetUserIds.length) {
          return new NextResponse("Forbidden — one or more assignees do not belong to your team", { status: 403 });
        }
      }
    }

    const results = [];

    for (const assignment of assignments) {
      const { candidateId, userId } = assignment;

      // Get the candidate with contacts — strictly verify it belongs to poolId
      const candidate = await (prismadbCrm as any).crm_Lead_Candidates.findFirst({
        where: { id: candidateId, pool: poolId },
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
          // Update assignment strictly within targetTeamId
          await (prismadbCrm as any).crm_Leads.updateMany({
            where: {
              id: existing.lead,
              ...(targetTeamId ? { team_id: targetTeamId } : {}),
            },
            data: { assigned_to: userId },
          });
          continue;
        }

        // Check if Account already exists (by domain or name) within targetTeamId
        let accountId = null;
        const domain = candidate.domain || (candidate.homepageUrl ? new URL(candidate.homepageUrl).hostname : null);

        if (domain) {
          const existingAccount = await (prismadbCrm as any).crm_Accounts.findFirst({
            where: {
              ...(targetTeamId ? { team_id: targetTeamId } : {}),
              OR: [
                { website: { contains: domain } },
                { email: { contains: domain } }
              ]
            }
          });
          if (existingAccount) accountId = existingAccount.id;
        }

        if (!accountId && candidate.companyName) {
          const existingAccount = await (prismadbCrm as any).crm_Accounts.findFirst({
            where: {
              name: candidate.companyName,
              ...(targetTeamId ? { team_id: targetTeamId } : {}),
            }
          });
          if (existingAccount) accountId = existingAccount.id;
        }

        if (!accountId) {
          const newAccount = await (prismadbCrm as any).crm_Accounts.create({
            data: {
              name: candidate.companyName || "Unknown Company",
              description: candidate.description,
              industry: candidate.industry,
              website: candidate.homepageUrl,
              team_id: targetTeamId,
              status: "Active",
              assigned_to: userId,
              createdBy: session!.user.id
            }
          });
          accountId = newAccount.id;
        }

        let contactId = null;
        const existingContact = contact.email
          ? await (prismadbCrm as any).crm_Contacts.findFirst({
              where: {
                email: contact.email,
                ...(targetTeamId ? { team_id: targetTeamId } : {}),
              }
            })
          : null;

        if (existingContact) {
          contactId = existingContact.id;
          if (!existingContact.account_id) {
            await (prismadbCrm as any).crm_Contacts.update({
              where: { id: contactId },
              data: { account_id: accountId }
            });
          }
        } else {
          const parts = (contact.fullName || "").split(" ");
          const firstName = parts[0] || "";
          const lastName = parts.slice(1).join(" ") || "";

          const newContact = await (prismadbCrm as any).crm_Contacts.create({
            data: {
              first_name: firstName,
              last_name: lastName,
              email: contact.email,
              mobile_phone: contact.phone,
              job_title: contact.title,
              account_id: accountId,
              team_id: targetTeamId,
              status: true,
              assigned_to: userId,
              created_by: session!.user.id
            }
          });
          contactId = newContact.id;
        }

        // Update Candidate with Account Link
        await (prismadbCrm as any).crm_Lead_Candidates.update({
          where: { id: candidateId },
          data: {
            accountsIDs: accountId,
            status: "CONVERTED"
          }
        });

        results.push({ candidateId, contactId, accountId });
      }
    }

    await logActivityInternal(session!.user.email || "SYSTEM", "CREATE", "crm_Leads", `Assigned ${results.length} candidates from pool ${poolId} to users`, pool.team_id || "");

    return NextResponse.json({
      success: true,
      assigned: results.length,
      results
    }, { status: 200 });
  } catch (error) {
    systemLogger.error("[LEADS_POOL_ASSIGN]", error);
    return new NextResponse("Failed to assign candidates", { status: 500 });
  }
}
