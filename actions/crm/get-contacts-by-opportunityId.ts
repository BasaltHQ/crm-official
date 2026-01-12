import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getContactsByOpportunityId = async (opportunityId: string) => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();

  if (!session || (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin)) return [];

  const whereClause: any = {
    assigned_opportunities: {
      some: {
        id: opportunityId,
      },
    },
  };
  if (!teamInfo?.isGlobalAdmin) {
    whereClause.team_id = teamInfo?.teamId;
  }
  if (teamInfo?.teamRole === "MEMBER" || teamInfo?.teamRole === "VIEWER") {
    whereClause.assigned_to = teamInfo?.userId;
  }

  const data = await (prismadb.crm_Contacts as any).findMany({
    where: whereClause,
    include: {
      assigned_to_user: {
        select: {
          name: true,
        },
      },
      crate_by_user: {
        select: {
          name: true,
        },
      },
      assigned_accounts: true,
    },
  });
  return data;
};
