import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { title, slug, category, order, content, videoUrl, resources } = body;

        const doc = await prismadb.docArticle.create({
            data: {
                title,
                slug,
                category,
                order,
                content,
                videoUrl,
                resources,
            },
        });

        return NextResponse.json(doc);
    } catch (error) {
        console.log("[DOCS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
