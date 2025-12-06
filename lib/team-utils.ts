
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

export const getCurrentUserTeamId = async () => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;

    const user = await (prismadb.users as any).findUnique({
        where: { email: session.user.email },
        select: { team_id: true, is_admin: true }
    });

    return {
        teamId: user?.team_id,
        isAdmin: user?.is_admin
    };
}
