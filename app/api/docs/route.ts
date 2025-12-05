import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const slug = searchParams.get("slug");

        if (slug) {
            const doc = await prismadb.docArticle.findUnique({
                where: { slug },
            });
            return NextResponse.json(doc);
        }

        const docs = await prismadb.docArticle.findMany({
            orderBy: { order: "asc" },
        });
        return NextResponse.json(docs);
    } catch (error) {
        console.error("[DOCS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { title, slug, category, content, videoUrl, order } = body;

        const doc = await prismadb.docArticle.create({
            data: {
                title,
                slug,
                category,
                content,
                videoUrl,
                order: parseInt(order) || 0,
            },
        });

        return NextResponse.json(doc);
    } catch (error) {
        console.error("[DOCS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, title, slug, category, content, videoUrl, order } = body;

        const doc = await prismadb.docArticle.update({
            where: { id },
            data: {
                title,
                slug,
                category,
                content,
                videoUrl,
                order: parseInt(order) || 0,
            },
        });

        return NextResponse.json(doc);
    } catch (error) {
        console.error("[DOCS_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return new NextResponse("ID required", { status: 400 });

        await prismadb.docArticle.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[DOCS_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
