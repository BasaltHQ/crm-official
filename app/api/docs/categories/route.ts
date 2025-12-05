import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

export async function GET() {
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
