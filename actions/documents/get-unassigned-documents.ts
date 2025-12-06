import { prismadb } from "@/lib/prisma";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getUnassignedDocuments = async () => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();
  const teamId = teamInfo?.teamId;

  if (!session || !teamId) return [];

  const data = await (prismadb.documents as any).findMany({
    where: {
      tasksIDs: { isEmpty: true },
      team_id: teamId,
    },
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
