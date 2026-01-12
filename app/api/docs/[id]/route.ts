import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prismadb } from "@/lib/prisma";
import { logActivity } from "@/actions/audit";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) return new NextResponse("Doc ID is required", { status: 400 });

        const doc = await prismadb.docArticle.findUnique({
            where: { id },
        });

        return NextResponse.json(doc);
    } catch (error) {
        console.log("[DOC_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { title, slug, category, order, content, videoUrl, resources } = body;

        const doc = await prismadb.docArticle.update({
            where: { id },
            data: {
                title,
                slug,
                category,
                order,
                content,
                videoUrl,

                resources,
            } as any,
        });

        await logActivity("Updated Documentation", "Documentation", `Updated article: ${doc.title}`);

        revalidatePath('/docs');
        return NextResponse.json(doc);
    } catch (error) {
        console.log("[DOC_PATCH]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const doc = await prismadb.docArticle.delete({
            where: { id },
        });

        revalidatePath('/docs');
        return NextResponse.json(doc);
    } catch (error) {
        console.log("[DOC_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
