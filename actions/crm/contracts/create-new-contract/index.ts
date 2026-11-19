"use server";

import { prismadb } from "@/lib/prisma";
import { CreateNewContract } from "./schema";
import { InputType, ReturnType } from "./types";

import { createSafeAction } from "@/lib/create-safe-action";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error || !session?.user?.id || !teamInfo) {
    return {
      error: "User not logged in.",
    };
  }

  const {
    title,
    value,
    startDate,
    endDate,
    renewalReminderDate,
    customerSignedDate,
    companySignedDate,
    description,
    account,
    assigned_to,
  } = data;

  if (!title || !value) {
    return {
      error: "Please fill in all the required fields.",
    };
  }

  try {
    const teamId = teamInfo.teamId;

    if (account) {
      const acc = await prismadb.crm_Accounts.findUnique({
        where: { id: account },
        select: { id: true, team_id: true },
      });
      if (!acc || !validateResourceOwnership(teamId, acc.team_id, teamInfo.isPlatformAdmin)) {
        return { error: "Invalid account for this team." };
      }
    }

    if (assigned_to && teamId && !teamInfo.isPlatformAdmin) {
      const assignee = await prismadb.users.findFirst({
        where: { id: assigned_to, team_id: teamId },
        select: { id: true },
      });
      if (!assignee) {
        return { error: "Invalid assignee for this team." };
      }
    }

    await (prismadb.crm_Contracts as any).create({
      data: {
        v: 0,
        team_id: teamId,
        title,
        value: parseFloat(value),
        startDate,
        endDate,
        renewalReminderDate,
        customerSignedDate,
        companySignedDate,
        description,
        account: account || undefined,
        assigned_to: assigned_to || undefined,
        createdBy: session.user.id,
      },
    });
  } catch (error) {
    console.log(error);
    return {
      error:
        "Something went wrong while trying to run CreateNewContract action. Please try again.",
    };
  }

  return { data: { title } };
};

export const createNewContract = createSafeAction(CreateNewContract, handler);
