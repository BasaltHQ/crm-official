"use server";

import { prismadb } from "@/lib/prisma";
import { UpdateContract } from "./schema";
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
    id,
    title,
    value,
    startDate,
    endDate,
    renewalReminderDate,
    customerSignedDate,
    companySignedDate,
    description,
    status,
    account,
    assigned_to,
  } = data;

  if (!id) {
    return {
      error: "No contract ID provided.",
    };
  }

  if (!title || !value) {
    return {
      error: "Please fill in all the required fields.",
    };
  }

  try {
    const existing = await prismadb.crm_Contracts.findUnique({
      where: { id: data.id },
      select: { id: true, team_id: true, v: true },
    });
    if (!existing) {
      return { error: "Contract not found." };
    }
    if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
      return { error: "Forbidden." };
    }

    const targetTeamId = existing.team_id || teamInfo.teamId;

    if (account) {
      const acc = await prismadb.crm_Accounts.findUnique({
        where: { id: account },
        select: { id: true, team_id: true },
      });
      if (!acc || !validateResourceOwnership(targetTeamId, acc.team_id, teamInfo.isPlatformAdmin)) {
        return { error: "Invalid account for this team." };
      }
    }

    if (assigned_to && targetTeamId && !teamInfo.isPlatformAdmin) {
      const assignee = await prismadb.users.findFirst({
        where: { id: assigned_to, team_id: targetTeamId },
        select: { id: true },
      });
      if (!assignee) {
        return { error: "Invalid assignee for this team." };
      }
    }

    await prismadb.crm_Contracts.update({
      where: {
        id: data.id,
      },
      data: {
        v: (existing.v || 0) + 1,
        title,
        value: parseFloat(value),
        startDate,
        endDate,
        renewalReminderDate,
        customerSignedDate,
        companySignedDate,
        description,
        status,
        account: account || undefined,
        assigned_to: assigned_to || undefined,
        updatedBy: session.user.id,
      },
    });
  } catch (error) {
    console.log(error);
    return {
      error:
        "Something went wrong while trying to run UpdateContract action. Please try again.",
    };
  }

  return { data: { title } };
};

export const updateContract = createSafeAction(UpdateContract, handler);
