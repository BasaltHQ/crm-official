"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam } from "@/lib/api-utils";
import { sanitizeUser } from "@/lib/security/authz";

export const getAllCrmData = async () => {
  const { error, session, teamInfo } = await getSessionAndTeam();

  if (error || !session || !teamInfo?.teamId) return { users: [], accounts: [], opportunities: [], leads: [], contacts: [], contracts: [], saleTypes: [], saleStages: [], campaigns: [], industries: [], boards: [] };

  const whereClause: any = {
    team_id: teamInfo.teamId,
  };

  const usersWhere = {
    userStatus: "ACTIVE" as any,
    team_id: teamInfo.teamId,
  };

  const accountsWhere = {
    ...whereClause,
    NOT: [
      { name: { startsWith: "Email -" } },
      { name: { startsWith: "Meeting" } },
      { name: { startsWith: "Call" } },
      { name: { startsWith: "Amazon SES" } },
      { name: { startsWith: "Project Documents" } },
    ],
  };

  const [
    users,
    accounts,
    opportunities,
    leads,
    contacts,
    contracts,
    saleTypes,
    saleStages,
    campaigns,
    industries,
    boards,
  ] = await Promise.all([
    prismadb.users.findMany({ where: usersWhere }),
    (prismadb.crm_Accounts as any).findMany({ where: accountsWhere }),
    prismadb.crm_Opportunities.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        status: true,
        expected_revenue: true,
        assigned_to: true,
        assigned_to_user: { select: { avatar: true, name: true } },
      }
    }),
    prismadb.crm_Leads.findMany({
      where: whereClause,
      select: { id: true, firstName: true, lastName: true, company: true, email: true, status: true, assigned_to: true }
    }),
    (prismadb.crm_Contacts as any).findMany({
      where: whereClause,
      select: { id: true, first_name: true, last_name: true, email: true, status: true, assigned_to: true }
    }),
    (prismadb.crm_Contracts as any).findMany({ where: whereClause }),
    prismadb.crm_Opportunities_Type.findMany({}),
    prismadb.crm_Opportunities_Sales_Stages.findMany({}),
    prismadb.crm_campaigns.findMany({}),
    prismadb.crm_Industry_Type.findMany({}),
    prismadb.boards.findMany({ where: whereClause, select: { id: true, title: true } }),
  ]);

  const data = {
    users: sanitizeUser(users),
    accounts,
    opportunities,
    leads,
    contacts,
    contracts,
    saleTypes,
    saleStages,
    campaigns,
    industries,
    boards,
  };

  return data;
};
