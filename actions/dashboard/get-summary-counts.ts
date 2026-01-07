import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export type DashboardCounts = {
  leads: number;
  tasks: number;
  boards: number;
  contacts: number;
  accounts: number;
  contracts: number;
  invoices: number;
  documents: number;
  opportunities: number; // Combined: CRM + Project opportunities
  users: number; // active users
  revenue: number; // expected revenue from ACTIVE opportunities (both CRM and Project opportunities)
  storageMB: number; // total storage in MB (rounded to 2 decimals)
};

export const getSummaryCounts = async (): Promise<DashboardCounts> => {
  // Get team context for filtering
  const teamInfo = await getCurrentUserTeamId();
  const teamId = teamInfo?.teamId;
  const isGlobalAdmin = teamInfo?.isGlobalAdmin;

  // Build team filter - global admins see all, others see only their team
  const teamFilter = isGlobalAdmin ? {} : teamId ? { team_id: teamId } : { team_id: "no-team-fallback" };

  const [
    leads,
    tasks,
    boards,
    contacts,
    accounts,
    contracts,
    invoices,
    documents,
    crmOpportunities,
    projectOpportunities,
    users,
    crmRevenueAgg,
    projectRevenueAgg,
    storageAgg,
  ] = await prismadb.$transaction([
    prismadb.crm_Leads.count({ where: teamFilter }),
    prismadb.tasks.count({ where: teamFilter }),
    prismadb.boards.count({ where: teamFilter }),
    prismadb.crm_Contacts.count({ where: teamFilter }),
    prismadb.crm_Accounts.count({ where: teamFilter }),
    prismadb.crm_Contracts.count({ where: teamFilter }),
    prismadb.invoices.count({ where: teamFilter }),
    prismadb.documents.count({ where: teamFilter }),
    // Count CRM Opportunities
    prismadb.crm_Opportunities.count({ where: teamFilter }),
    // Count Project Opportunities (these don't have team_id, so count all OPEN ones for user's projects)
    (prismadb.project_Opportunities as any).count({ where: { status: "OPEN" } }),
    prismadb.users.count({ where: { ...teamFilter, userStatus: "ACTIVE" as any } }),
    // CRM Opportunities expected revenue
    prismadb.crm_Opportunities.aggregate({
      where: { ...teamFilter, status: "ACTIVE" as any },
      _sum: { expected_revenue: true }
    }),
    // Project Opportunities value estimate (for OPEN opportunities)
    (prismadb.project_Opportunities as any).aggregate({
      where: { status: "OPEN" },
      _sum: { valueEstimate: true }
    }),
    prismadb.documents.aggregate({ where: teamFilter, _sum: { size: true } }),
  ]);

  // Combine opportunities from both CRM and Project systems
  const opportunities = crmOpportunities + projectOpportunities;

  // Combine revenue from both CRM opportunities and Project opportunities
  const crmRevenue = Number((crmRevenueAgg as any)._sum?.expected_revenue ?? 0);
  const projectRevenue = Number((projectRevenueAgg as any)._sum?.valueEstimate ?? 0);
  const revenue = crmRevenue + projectRevenue;

  const storageBytes = Number((storageAgg as any)._sum?.size ?? 0);
  const storageMB = Math.round((storageBytes / 1_000_000) * 100) / 100;

  return {
    leads,
    tasks,
    boards,
    contacts,
    accounts,
    contracts,
    invoices,
    documents,
    opportunities,
    users,
    revenue,
    storageMB,
  };
};
