import { prismadb } from "@/lib/prisma";

export const getBoards = async (userId: string) => {
  if (!userId) {
    return null;
  }
  const data = await prismadb.boards.findMany({
    where: {
      OR: [
        {
          user: userId,
        },
        {
          visibility: "public",
        },
      ],
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
      } catch {}
      return { ...b, brand_logo_url: null };
    })
  );

  return withBrand;
};
