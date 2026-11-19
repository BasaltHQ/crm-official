"use server";

import dayjs from "dayjs";
import axios from "axios";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AiTasksReportEmail from "@/emails/AiTasksReport";
import sendEmail from "@/lib/sendmail";
import { render } from "@react-email/render";

export async function getUserAiTasks(_clientSession?: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.error === "SessionInvalidated") {
    return { message: "Unauthorized" };
  }


  const today = dayjs().startOf("day");
  const nextWeek = dayjs().add(7, "day").startOf("day");

  let prompt = "";

  const user = await prismadb.users.findUnique({
    where: {
      id: session.user.id,
    },
  });

  if (!user) return { message: "No user found" };

  const getTaskPastDue = await prismadb.tasks.findMany({
    where: {
      AND: [
        {
          user: session.user.id,
          taskStatus: "ACTIVE",
          dueDateAt: {
            lte: new Date(),
          },
        },
      ],
    },
  });

  const getTaskPastDueInSevenDays = await prismadb.tasks.findMany({
    where: {
      AND: [
        {
          user: session.user.id,
          taskStatus: "ACTIVE",
          dueDateAt: {
            //lte: dayjs().add(7, "day").toDate(),
            gt: today.toDate(), // Due date is greater than or equal to today
            lt: nextWeek.toDate(), // Due date is less than next week (not including today)
          },
        },
      ],
    },
  });

  if (!getTaskPastDue || !getTaskPastDueInSevenDays) {
    return { message: "No tasks found" };
  }

  prompt = `Hi, Iam ${process.env.NEXT_PUBLIC_APP_URL} API Bot.
      \n\n
      There are ${getTaskPastDue.length} tasks past due and ${getTaskPastDueInSevenDays.length
    } tasks due in the next 7 days.
      \n\n
      Details today tasks: ${JSON.stringify(getTaskPastDue, null, 2)}
      \n\n
      Details next 7 days tasks: ${JSON.stringify(
      getTaskPastDueInSevenDays,
      null,
      2
    )}
      \n\n
      As a personal assistant, write a message  to remind tasks and write detail summary. And also do not forget to send them a some positive vibes.
      \n\n
      Final result must be in MDX format.
      `;

  if (!prompt) return { message: "No prompt found" };

  const getAiResponse = await axios
    .post(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/openai/create-chat-completion`,
      {
        prompt: prompt,
        userId: session.user.id,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
    .then((res) => res.data);

  //console.log(getAiResponse, "getAiResponse");
  //console.log(getAiResponse.response.message.content, "getAiResponse");

  //skip if api response is error
  if (getAiResponse.error) {
    console.log("Error from OpenAI API");
  } else {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
      const hostname = new URL(baseUrl || "http://localhost").hostname;
      let fromAddress = process.env.EMAIL_FROM || `no-reply@${hostname}`;
      if (!fromAddress.includes("@")) {
        fromAddress = `no-reply@${hostname}`;
      }

      const subject = `${process.env.NEXT_PUBLIC_APP_NAME} OpenAI Project manager assistant from: ${process.env.NEXT_PUBLIC_APP_URL}`;

      const reactEmail = AiTasksReportEmail({
        username: session.user.name,
        avatar: session.user.avatar,
        userLanguage: session.user.userLanguage,
        data: getAiResponse.response.message.content,
      });

      await sendEmail({
        from: fromAddress,
        to: user.email!,
        subject,
        text: getAiResponse.response.message.content,
        html: await render(reactEmail),
      });
      //console.log("AI tasks email sent");
    } catch (error) {
      console.log(error, "Error from get-user-ai-tasks");
    }
  }

  return { user: user.email };
}
