"use server";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getTasksCount = async () => {
  const teamInfo = await getCurrentUserTeamId();
  if (!teamInfo?.userId || !teamInfo.teamId) return 0;

  const data = await prismadb.tasks.count({
    where: { team_id: teamInfo.teamId },
  });
  return data;
};

export const getUsersTasksCount = async (userId: string) => {
  const teamInfo = await getCurrentUserTeamId();
  if (!teamInfo?.userId || !teamInfo.teamId) return 0;

  const targetUserId = userId === teamInfo.userId || teamInfo.isAdmin ? userId : teamInfo.userId;

  const data = await prismadb.tasks.count({
    where: {
      team_id: teamInfo.teamId,
      user: targetUserId,
      taskStatus: {
        not: "COMPLETE",
      },
    },
  });
  return data;
};
