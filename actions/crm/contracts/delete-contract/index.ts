"use server";

import { prismadb } from "@/lib/prisma";
import { DeleteContract } from "./schema";
import { InputType, ReturnType } from "./types";

import { createSafeAction } from "@/lib/create-safe-action";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error || !teamInfo) {
    return {
      error: "User not logged in.",
    };
  }

  const { id } = data;

  if (!id) {
    return {
      error: "Please fill in all the required fields.",
    };
  }

  try {
    const existing = await prismadb.crm_Contracts.findUnique({
      where: { id },
      select: { id: true, team_id: true },
    });
    if (!existing) {
      return { error: "Contract not found." };
    }
    if (!validateResourceOwnership(teamInfo.teamId, existing.team_id, teamInfo.isPlatformAdmin)) {
      return { error: "Forbidden." };
    }

    await prismadb.crm_Contracts.delete({
      where: {
        id: id,
      },
    });
  } catch (error) {
    console.log(error);
    return {
      error:
        "Something went wrong while trying to run DeleteContract action. Please try again.",
    };
  }

  return { data: { id } };
};

export const deleteContract = createSafeAction(DeleteContract, handler);
