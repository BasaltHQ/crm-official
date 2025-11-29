import { getBoard } from "@/actions/projects/get-board";
import React, { Suspense } from "react";

import Container from "@/app/[locale]/(routes)/components/ui/Container";
import NewSectionDialog from "./dialogs/NewSection";

import NewTaskInProjectDialog from "./dialogs/NewTaskInProject";
import { getActiveUsers } from "@/actions/get-users";
import { getBoardSections } from "@/actions/projects/get-board-sections";
import DeleteProjectDialog from "./dialogs/DeleteProject";
import { getKanbanData } from "@/actions/projects/get-kanban-data";
import Kanban from "./components/Kanban";
import Gantt from "./components/Gantt";

import ProjectEditPanel from "./components/ProjectEditPanel";
import { getBoards } from "@/actions/projects/get-boards";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Users } from "@prisma/client";
import AiAssistantProject from "./components/AiAssistantProject";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lock } from "lucide-react";

interface BoardDetailProps {
  params: Promise<{ boardId: string }>;
}

export const maxDuration = 300;

const BoardPage = async (props: BoardDetailProps) => {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const user = session?.user;
  const { boardId } = params;
  const board: any = await getBoard(boardId);
  const boards = await getBoards(user?.id!);
  const users: Users[] = await getActiveUsers();
  const sections: any = await getBoardSections(boardId);
  const kanbanData = await getKanbanData(boardId);

  // fetch brand logo for hero header
  let brandLogoUrl: string | null = null;
  try {
    const brandRes = await fetch(`/api/projects/${boardId}/brand`, { cache: 'no-store' as any });
    if (brandRes.ok) {
      const bj = await brandRes.json().catch(() => null);
      brandLogoUrl = bj?.brand_logo_url || null;
    }
  } catch {}

  //console.log(board, "board");
  return (
    <Container
      title={board?.board?.title}
      description={board?.board?.description}
      visibility={board?.board?.visibility}
    >
      {brandLogoUrl ? (
        <img
          src={brandLogoUrl}
          alt="Project Logo"
          className="mb-2 h-20 w-20 rounded-xl border object-contain shadow-sm"
        />
      ) : null}



      {/* Tabs: Settings and Kanban */}
      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="gantt">Gantt</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <div className="flex items-center justify-between py-5 w-full">
            <div className="space-x-2">
              <NewSectionDialog boardId={boardId} />
              <NewTaskInProjectDialog
                boardId={boardId}
                users={users}
                sections={sections}
              />
              <AiAssistantProject session={session} boardId={boardId} />
            </div>
          </div>
          <Kanban
            data={kanbanData.sections}
            boardId={boardId}
            boards={boards}
            users={users}
          />
        </TabsContent>
        <TabsContent value="gantt">
          <div className="flex items-center justify-between py-5 w-full">
            <div className="space-x-2"></div>
          </div>
          <Gantt data={kanbanData.sections as any} />
        </TabsContent>
        <TabsContent value="settings">
          <div className="mb-6">
            <ProjectEditPanel boardId={boardId} />
          </div>
          <div className="flex items-center justify-between py-5 w-full">
            <div />
            <div>
              <DeleteProjectDialog
                boardId={boardId}
                boardName={board.board.title}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>


    </Container>
  );
};

export default BoardPage;
