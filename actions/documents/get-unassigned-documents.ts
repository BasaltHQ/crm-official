import { prismadb } from "@/lib/prisma";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getUnassignedDocuments = async () => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();
  const teamId = teamInfo?.teamId;

  if (!session || (!teamId && !teamInfo?.isGlobalAdmin)) return [];

  // Build where clause based on role
  const whereClause: any = {
    tasksIDs: { isEmpty: true },
  };

  if (teamInfo?.isGlobalAdmin) {
    // Global admins see all unassigned documents
  } else if (teamInfo?.teamRole === "MEMBER") {
    // Members only see their own created or assigned unassigned documents
    whereClause.team_id = teamId;
    whereClause.OR = [
      { created_by_user: teamInfo?.userId },
      { assigned_user: teamInfo?.userId }
    ];
  } else {
    // Other roles (ADMIN, OWNER) see all team unassigned documents
    whereClause.team_id = teamId;
  }

  const data = await (prismadb.documents as any).findMany({
    where: whereClause,
    include: {
      created_by: {
        select: { name: true },
      },
      assigned_to_user: {
        select: { name: true },
      },
    },
    orderBy: {
      date_created: "desc" as any,
    },
  });
  return data;
};
