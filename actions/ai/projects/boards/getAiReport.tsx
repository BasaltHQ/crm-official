"use server";

import axios from "axios";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import sendEmail from "@/lib/sendmail";
import { render } from "@react-email/render";
import AiProjectReportEmail from "@/emails/AiProjectReport";

export async function getAiReport(_clientSession: any, boardId: string) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error || !session?.user?.id || !teamInfo) {
    return { error: "Unauthorized" };
  }

  if (!boardId) {
    return { error: "Missing boardId" };
  }

  // Verify board exists, belongs to caller's team, and is accessible to the user
  const board = await prismadb.boards.findUnique({
    where: { id: boardId },
    select: {
      id: true,
      user: true,
      sharedWith: true,
      visibility: true,
      team_id: true,
    },
  });
  if (!board) {
    return { error: "Board not found" };
  }
  if (!validateResourceOwnership(teamInfo.teamId, board.team_id, teamInfo.isPlatformAdmin)) {
    return { error: "Forbidden" };
  }

  const userId = session.user.id;
  const canAccessBoard =
    teamInfo.isPlatformAdmin ||
    teamInfo.isAdmin ||
    board.user === userId ||
    (board.sharedWith || []).includes(userId) ||
    board.visibility === "public";

  if (!canAccessBoard) {
    return { error: "Forbidden" };
  }

  const user = await prismadb.users.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) return { message: "No user found" };

  const boardData = await prismadb.sections.findMany({
    where: {
      board: boardId,
    },
    include: {
      tasks: {
        select: {
          title: true,
          content: true,
          createdAt: true,
          dueDateAt: true,
        },
      },
    },
  });

  //console.log(JSON.stringify(boardData, null, 2), "boardData");

  let prompt = `As a super skilled project manager, write me a project management summary and then sort sections and tasks details based on the following tasks data in JSON format: ${JSON.stringify(
    boardData,
    null,
    2
  )}.`;

  switch (user.userLanguage) {
    case "en":
      prompt = prompt + `Response must be in English language and MDX format.`;

      break;
  }

  if (!prompt) return { message: "No prompt found" };

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const getAiResponse = await axios
    .post(
      `${appUrl}/api/openai/create-chat-completion`,
      {
        prompt: prompt,
        userId,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
    .then((res) => res.data);

  if (getAiResponse.error) {
    console.log("Error from OpenAI API");
  } else {
    try {
      const emailHtml = await render(
        AiProjectReportEmail({
          username: user.name || session.user.name || "User",
          avatar: user.avatar || (session.user as any).avatar,
          userLanguage: user.userLanguage || "en",
          data: getAiResponse.response.message.content,
        })
      );

      await sendEmail({
        from: process.env.EMAIL_FROM!,
        to: user.email!,
        subject: `${process.env.NEXT_PUBLIC_APP_NAME} OpenAI Project manager assistant from: ${process.env.NEXT_PUBLIC_APP_URL}`,
        text: getAiResponse.response.message.content,
        html: emailHtml,
      });
    } catch (error) {
      console.log(error, "Error from getAiReport");
    }
  }

  return { user: user.email };
}
