import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";

import NewTaskFromCRMEmail from "@/emails/NewTaskFromCRM";
import NewTaskFromCRMToWatchersEmail from "@/emails/NewTaskFromCRMToWatchers";
import sendEmail from "@/lib/sendmail";
import { render } from "@react-email/render";
import { systemLogger } from "@/lib/logger";

//Create new task from CRM in project route
export async function POST(
  req: Request,
  props: { params: Promise<{ accountId: string }> }
) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const params = await props.params;
  const body = await req.json();
  const { title, user: requestedAssignee, priority, content, account, dueDateAt } = body;

  const targetAccountId = params?.accountId || account;

  if (!title || !priority || !content || !targetAccountId) {
    return new NextResponse("Missing one of the task data ", { status: 400 });
  }

  try {
    const accountRecord = await prismadb.crm_Accounts.findUnique({
      where: { id: targetAccountId },
      select: { id: true, team_id: true },
    });
    if (!accountRecord) {
      return new NextResponse("Account not found", { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo!.teamId, accountRecord.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const creatorUserId = session!.user.id;
    let assignedUserId = creatorUserId;

    if (requestedAssignee && requestedAssignee !== creatorUserId) {
      const assigneeRecord = await prismadb.users.findFirst({
        where: {
          id: String(requestedAssignee),
          ...(accountRecord.team_id ? { team_id: accountRecord.team_id } : {}),
        },
        select: { id: true },
      });
      if (!assigneeRecord) {
        return new NextResponse("Forbidden — assignee is not a member of this account's team", { status: 403 });
      }
      assignedUserId = assigneeRecord.id;
    }

    const task = await prismadb.crm_Accounts_Tasks.create({
      data: {
        v: 0,
        priority: priority,
        title: title,
        content,
        account: targetAccountId,
        dueDateAt,
        createdBy: creatorUserId,
        updatedBy: creatorUserId,
        user: assignedUserId,
        team_id: accountRecord.team_id || teamInfo!.teamId || undefined,
        taskStatus: "ACTIVE",
      },
    });

    //Notification to assignee who is not the task creator (already verified to belong to account.team_id)
    if (assignedUserId !== creatorUserId) {
      try {
        const notifyRecipient = await prismadb.users.findFirst({
          where: {
            id: assignedUserId,
            ...(accountRecord.team_id ? { team_id: accountRecord.team_id } : {}),
          },
        });

        if (notifyRecipient?.email) {
          const emailHtml = await render(
            NewTaskFromCRMEmail({
              taskFromUser: session!.user.name!,
              username: notifyRecipient.name!,
              userLanguage: "en",
              taskData: task,
            })
          );

          await sendEmail({
            from: process.env.EMAIL_FROM,
            to: notifyRecipient.email,
            subject: `New task - ${title}.`,
            text: `New task assigned from ${session!.user.name}: ${title}`,
            html: emailHtml,
          });
        }
      } catch (error) {
        console.log(error);
      }
    }

    //Notification to users watching the account (strictly filtered to account.team_id)
    if (accountRecord.team_id) {
      try {
        const emailRecipients = await prismadb.users.findMany({
          where: {
            id: {
              not: creatorUserId,
            },
            team_id: accountRecord.team_id,
            watching_accountsIDs: {
              has: targetAccountId,
            },
          },
        });

        for (const watcher of emailRecipients) {
          if (!watcher.email) continue;
          const emailHtml = await render(
            NewTaskFromCRMToWatchersEmail({
              taskFromUser: session!.user.name!,
              username: watcher.name!,
              userLanguage: "en",
              taskData: task,
            })
          );

          await sendEmail({
            from: process.env.EMAIL_FROM,
            to: watcher.email,
            subject: `New task - ${title}.`,
            text: `New task created by ${session!.user.name}: ${title}`,
            html: emailHtml,
          });
        }
      } catch (error) {
        console.log(error);
      }
    }

    import("@/actions/quests/add-raw-xp")
      .then((m) => m.addRawXP({ userId: creatorUserId, xpAmount: 2, reason: "Created Account Task" }))
      .catch((e) => systemLogger.warn(`[CREATE_TASK_GAMIFICATION] Failed to award XP: ${e?.message}`));

    return NextResponse.json(task);
  } catch (error) {
    systemLogger.error("[NEW_BOARD_POST]", error);
    return new NextResponse("Initial error", { status: 500 });
  }
}
