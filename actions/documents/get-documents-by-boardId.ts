import { prismadb } from "@/lib/prisma";

export const getDocumentsByBoardId = async (boardId: string) => {
  // Find sections for the board
  const sections = await prismadb.sections.findMany({
    where: { board: boardId },
    select: { id: true },
  });
  const sectionIds = sections.map(s => s.id);

  // Find tasks in those sections
  const tasks = await prismadb.tasks.findMany({
    where: { section: { in: sectionIds } },
    select: { id: true },
  });
  const taskIds = tasks.map(t => t.id);

  // Find documents attached to those tasks
  const documents = await prismadb.documents.findMany({
    where: {
      tasksIDs: { hasSome: taskIds },
    },
    include: {
      assigned_to_user: true,
    },
  });

  return documents;
};
