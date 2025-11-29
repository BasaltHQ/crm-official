import { prismadb } from "@/lib/prisma";

export const getUnassignedDocuments = async () => {
  const data = await prismadb.documents.findMany({
    where: {
      tasksIDs: { isEmpty: true },
    },
    include: {
      created_by: {
        select: { name: true },
      },
      assigned_to_user: {
        select: { name: true },
      },
    },
    orderBy: {
      date_created: "desc" as any,
    },
  });
  return data;
};
