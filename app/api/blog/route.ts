import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { logActivity } from "@/actions/audit";

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
        const { title, slug, content, excerpt, category, coverImage, author, publishedAt } = body;

        const post = await prismadb.blogPost.create({
            data: {
                title,
                slug,
                content,
                excerpt,
                category,
                coverImage,
                author,
                publishedAt: publishedAt ? new Date(publishedAt) : undefined,
            },
        });

        await logActivity(
            "Created Blog Post",
            "Blog",
            `Created post "${title}"`
        );

        revalidatePath('/blog');
        return NextResponse.json(post);
    } catch (error) {
        console.error("[BLOG_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const { id, title, slug, content, excerpt, category, coverImage, author, publishedAt } = body;

        const post = await prismadb.blogPost.update({
            where: { id },
            data: {
                title,
                slug,
                content,
                excerpt,
                category,
                coverImage,
                author,
                publishedAt: publishedAt ? new Date(publishedAt) : undefined,
            },
        });

        await logActivity(
            "Updated Blog Post",
            "Blog",
            `Updated post "${title}"`
        );

        revalidatePath('/blog');
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

        const post = await prismadb.blogPost.findUnique({ where: { id } });

        await prismadb.blogPost.delete({
            where: { id },
        });

        await logActivity(
            "Deleted Blog Post",
            "Blog",
            `Deleted post "${post?.title || id}"`
        );

        revalidatePath('/blog');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[BLOG_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
