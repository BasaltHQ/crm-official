import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentUserTeamId } from "@/lib/team-utils";

export const getBoards = async (userId: string) => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  const teamInfo = await getCurrentUserTeamId();
  if (!teamInfo?.teamId) return [];

  const data = await (prismadb.boards as any).findMany({
    where: {
      team_id: teamInfo.teamId,
      // Keep visibility logic if needed, but within team scope?
      // "Items ... stay with the team and is not visible by anyone else"
      // So public boards should only be public WITHIN the team.
      // So AND team_id.
    },
    include: {
      assigned_user: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  // Attach brand_logo_url if available via API route
  // Server-side fetch for brand logo via absolute pathless API (Next.js request context)
  const withBrand = await Promise.all(
    data.map(async (b: any) => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(b.id)}/brand`, { cache: "no-store" as any });
        if (res && res.ok) {
          const j = await res.json().catch(() => null);
          return { ...b, brand_logo_url: j?.brand_logo_url ?? null };
        }
      } catch { }
      return { ...b, brand_logo_url: null };
    })
  );

  return withBrand;
};
