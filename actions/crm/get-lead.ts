import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { isValidObjectId } from "@/lib/utils";

export const getLead = async (leadId: string) => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();

  if (!session || (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin)) return null;

  if (!isValidObjectId(leadId)) return null;

  const whereClause: any = { id: leadId };
  if (!teamInfo?.isGlobalAdmin) {
    whereClause.team_id = teamInfo?.teamId;
  }
  if (teamInfo?.teamRole === "MEMBER" || teamInfo?.teamRole === "VIEWER") {
    whereClause.assigned_to = teamInfo?.userId;
  }

  const data = await prismadb.crm_Leads.findFirst({
    where: whereClause,
    include: {
      assigned_to_user: {
        select: {
          id: true,
          name: true,
        },
      },
      assigned_accounts: true,
      assigned_documents: true,
    },
  });
  return data;
};
