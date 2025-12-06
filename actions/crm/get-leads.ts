import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getLeads = async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return [];
  }

  // Get user to check admin status
  const user = await prismadb.users.findUnique({
    where: { id: session.user.id },
    select: { is_admin: true, is_account_admin: true },
  });

  // Admins see all leads, regular users see only their assigned leads
  const teamInfo = await getCurrentUserTeamId();

  // If no team, return empty (or handle as special case)
  if (!teamInfo?.teamId) {
    // If system admin but no team, maybe return all? For now, strict isolation: separate teams.
    // But migration put everyone in 'ledger1'.
    return [];
  }

  const whereClause: any = {
    team_id: teamInfo.teamId
  };

  // If not admin/account_admin, restrict to assigned_to within the team
  if (!user?.is_admin && !user?.is_account_admin) {
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
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return data;
};
