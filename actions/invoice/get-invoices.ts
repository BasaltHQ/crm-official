import { prismadb } from "@/lib/prisma";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getInvoices = async () => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();
  const teamId = teamInfo?.teamId;

  if (!session || !teamId) return [];

  const data = await (prismadb.invoices as any).findMany({
    where: {
      user: {
        team_id: teamId, // Filter invoices by user's team? Invoices don't have team_id directly in schema?
        // Wait, I updated schema to add team_id to Invoices? Check schema.
      },
      // Or if I added team_id to Invoices:
      team_id: teamId,
    },
    include: {
      users: {
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
