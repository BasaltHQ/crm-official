import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const slug = searchParams.get("slug");

        if (slug) {
            const post = await prismadb.blogPost.findUnique({
                where: { slug },
            });
            return NextResponse.json(post);
        }

        const posts = await prismadb.blogPost.findMany({
            orderBy: { publishedAt: "desc" },
        });
        return NextResponse.json(posts);
    } catch (error) {
        console.error("[BLOG_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { title, slug, content, excerpt, category, coverImage } = body;

        const post = await prismadb.blogPost.create({
            data: {
                title,
                slug,
                content,
                excerpt,
                category,
                coverImage,
            },
        });

        return NextResponse.json(post);
    } catch (error) {
        console.error("[BLOG_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, title, slug, content, excerpt, category, coverImage } = body;

        const post = await prismadb.blogPost.update({
            where: { id },
            data: {
                title,
                slug,
                content,
                excerpt,
                category,
                coverImage,
            },
        });

        return NextResponse.json(post);
    } catch (error) {
        console.error("[BLOG_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return new NextResponse("ID required", { status: 400 });

        await prismadb.blogPost.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[BLOG_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
