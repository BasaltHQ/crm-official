import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

export const getInvoice = async (invoiceId: string) => {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error || !teamInfo) {
    throw new Error("Unauthorized");
  }

  const data = await prismadb.invoices.findUniqueOrThrow({
    where: {
      id: invoiceId,
    },
    include: {
      users: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!validateResourceOwnership(teamInfo.teamId, data.team_id, teamInfo.isPlatformAdmin)) {
    throw new Error("Forbidden");
  }

  return data;
};
