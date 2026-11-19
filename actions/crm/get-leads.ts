"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam } from "@/lib/api-utils";

export const getLeads = async () => {
  const { error, session, teamInfo } = await getSessionAndTeam();

  if (error || !session?.user?.id || !teamInfo?.teamId) {
    return [];
  }

  // Get user to check admin status
  const user = await prismadb.users.findUnique({
    where: { id: session.user.id },
    select: { is_admin: true, is_account_admin: true },
  });

  const whereClause: any = {
    team_id: teamInfo.teamId,
  };

  // If not admin/account_admin, restrict to assigned_to within the team
  if (!user?.is_admin && !user?.is_account_admin && !teamInfo.isAdmin && !teamInfo.isPlatformAdmin) {
    whereClause.assigned_to = session.user.id;
  }

  const data = await prismadb.crm_Leads.findMany({
    where: whereClause,
    include: {
      assigned_to_user: {
        select: {
          name: true,
        },
      },
      opportunities: {
        include: {
          quotes: {
            select: {
              id: true,
              title: true,
              totalAmount: true,
            },
          },
          assigned_account: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
};

//Get leads by month for chart
export const getLeadsByMonth = async (startDate?: Date, endDate?: Date, departmentId?: string) => {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error || !teamInfo?.teamId) return [];

  const whereClause: any = {
    team_id: teamInfo.teamId,
  };

  // Filter by Department (if applicable based on user assignment)
  if (departmentId && departmentId !== "all") {
    whereClause.assigned_department_id = departmentId;
  }

  // Add Dynamic Date Range
  if (startDate && endDate) {
    whereClause.createdAt = {
      gte: startDate,
      lte: endDate,
    };
  }

  const leads = await prismadb.crm_Leads.findMany({
    where: whereClause,
    select: {
      createdAt: true,
    },
  });

  if (!leads) {
    return [];
  }

  const leadsByMonth = leads.reduce(
    (acc: any, lead: any) => {
      const month = new Date(lead.createdAt).toLocaleString("default", {
        month: "long",
      });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    },
    {}
  );

  const chartData = Object.keys(leadsByMonth).map((month: any) => {
    return {
      name: month,
      Number: leadsByMonth[month],
    };
  });

  return chartData;
};
