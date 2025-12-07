import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { url, filename, mimeType, size, width, height, title, caption, altText, description } = body;

        if (!url || !filename) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        const mediaItem = await (prismadb as any).mediaItem.create({
            data: {
                url,
                filename,
                mimeType: mimeType || "application/octet-stream",
                size: size || 0,
                width: width || null,
                height: height || null,
                title: title || "",
                caption: caption || "",
                altText: altText || "",
                description: description || "",
                userId: (session.user as any).id,
            },
        });

        return NextResponse.json(mediaItem);
    } catch (error) {
        console.error("[MEDIA_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const limit = parseInt(searchParams.get("limit") || "50");
        const page = parseInt(searchParams.get("page") || "1");
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { filename: { contains: search, mode: "insensitive" } },
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        const [items, total] = await Promise.all([
            (prismadb as any).mediaItem.findMany({
                where,
                take: limit,
                skip,
                orderBy: { createdAt: "desc" },
            }),
            (prismadb as any).mediaItem.count({ where }),
        ]);

        return NextResponse.json({ items, total, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error("[MEDIA_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { id, title, caption, altText, description } = body;

        if (!id) {
            return new NextResponse("ID required", { status: 400 });
        }

        const mediaItem = await (prismadb as any).mediaItem.update({
            where: { id },
            data: {
                title,
                caption,
                altText,
                description,
            },
        });

        return NextResponse.json(mediaItem);
    } catch (error) {
        console.error("[MEDIA_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return new NextResponse("ID required", { status: 400 });
        }

        await (prismadb as any).mediaItem.delete({
            where: { id },
        });

        return new NextResponse("Deleted", { status: 200 });
    } catch (error) {
        console.error("[MEDIA_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
