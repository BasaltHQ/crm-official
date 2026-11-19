import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { sanitizeUser } from "@/lib/security/authz";
import { getServerSession } from "next-auth";

export const getUser = async () => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
    throw new Error("Unauthorized");
  }

  const data = await prismadb.users.findUnique({
    where: {
      id: session.user.id,
    },
    include: {
      assigned_team: {
        include: {
          assigned_plan: true,
        },
      },
    },
  });
  if (!data) throw new Error("User not found");
  return sanitizeUser(data) as any;
};
