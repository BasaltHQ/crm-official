"use server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

export async function setInactiveOpportunity(id: string) {
  if (!id) {
    return;
  }

  const { error, teamInfo } = await getSessionAndTeam();
  if (error || !teamInfo) {
    throw new Error("Unauthorized");
  }

  try {
    const existing = await prismadb.crm_Opportunities.findUnique({
      where: { id },
      select: { id: true, team_id: true },
    });
    if (!existing) {
      return;
    }
    if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
      throw new Error("Forbidden");
    }

    await prismadb.crm_Opportunities.update({
      where: {
        id,
      },
      data: {
        status: "INACTIVE",
      },
    });
  } catch (error) {
    console.error(error);
  }
}
