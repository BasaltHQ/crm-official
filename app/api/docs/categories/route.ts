import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";

export async function GET() {
  // ── Auth guard ──
  const session = await requireApiAuth();
  if (session instanceof Response) return session;

    try {
        const docs = await prismadb.docArticle.findMany({
            select: {
                category: true,
            },
            distinct: ['category'],
            orderBy: {
                category: 'asc',
            },
        });

        const categories = docs.map(doc => doc.category);

        return NextResponse.json(categories);
    } catch (error) {
        console.log("[DOCS_CATEGORIES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
