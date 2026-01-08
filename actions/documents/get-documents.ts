import { prismadb } from "@/lib/prisma";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getDocuments = async () => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();
  if (!session || (!teamInfo?.teamId && !teamInfo?.isGlobalAdmin)) return [];

  const whereClause: any = {};

  if (teamInfo?.isGlobalAdmin) {
    // Global admins see all documents
  } else if (teamInfo?.teamRole === "MEMBER") {
    // Members only see their own created or assigned documents
    whereClause.team_id = teamInfo?.teamId;
    whereClause.OR = [
      { created_by_user: teamInfo?.userId },
      { assigned_user: teamInfo?.userId }
    ];
  } else {
    // Other roles (ADMIN, OWNER) see all team documents
    whereClause.team_id = teamInfo?.teamId;
  }

  const data = await (prismadb.documents as any).findMany({
    where: whereClause,
    include: {
      created_by: {
        select: {
          name: true,
        },
      },
      assigned_to_user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      date_created: "desc",
    },
  });
  return data;
};
