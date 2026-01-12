import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getAccount = async (accountId: string) => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();

  if (!session || (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin)) return null;

  const whereClause: any = { id: accountId };
  if (!teamInfo?.isGlobalAdmin) {
    whereClause.team_id = teamInfo?.teamId;
  }
  if (teamInfo?.teamRole === "MEMBER" || teamInfo?.teamRole === "VIEWER") {
    whereClause.assigned_to = teamInfo?.userId;
  }

  const data = await prismadb.crm_Accounts.findFirst({
    where: whereClause,
    include: {
      contacts: true,
      opportunities: true,
      assigned_documents: true,
      invoices: true,
      assigned_to_user: {
        select: {
          name: true,
        },
      },
    },
  });
  return data;
};
