import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { isValidObjectId } from "@/lib/utils";

export const getOpportunity = async (opportunityId: string) => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();

  if (!session || (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin)) return null;

  if (!isValidObjectId(opportunityId)) return null;

  const whereClause: any = { id: opportunityId };
  if (!teamInfo?.isGlobalAdmin) {
    whereClause.team_id = teamInfo?.teamId;
  }
  if (teamInfo?.teamRole === "MEMBER" || teamInfo?.teamRole === "VIEWER") {
    whereClause.assigned_to = teamInfo?.userId;
  }

  const data = await prismadb.crm_Opportunities.findFirst({
    where: whereClause,
    include: {
      assigned_account: {
        select: {
          name: true,
        },
      },
      assigned_sales_stage: {
        select: {
          name: true,
        },
      },
      assigned_type: {
        select: {
          name: true,
        },
      },
      contacts: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          office_phone: true,
          mobile_phone: true,
          email: true,
        },
      },
      assigned_to_user: {
        select: {
          name: true,
          email: true,
        },
      },
      documents: {
        select: {
          id: true,
          document_name: true,
        },
      },
    },
  });
  return data;
};
