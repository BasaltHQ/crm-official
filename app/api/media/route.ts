import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { logActivity } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";
import { getSessionAndTeam } from "@/lib/api-utils";

async function getScopedTeamUserIds(teamId: string | null, currentUserId: string): Promise<string[]> {
    if (!teamId) return [currentUserId];
    const teamMembers = await prismadb.users.findMany({
        where: { team_id: teamId },
        select: { id: true },
    });
    return Array.from(new Set([currentUserId, ...teamMembers.map((u) => u.id)]));
}

function isValidHttpUrl(rawUrl: unknown): boolean {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return false;
    try {
        const parsed = new URL(rawUrl);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export async function POST(req: Request) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) {
            return error || new NextResponse("Unauthorized", { status: 401 });
        }

        if (!teamInfo.isAdmin) {
            return new NextResponse("Forbidden: Admin access required", { status: 403 });
        }

        const body = await req.json();
        const { url, filename, mimeType, size, width, height, title, caption, altText, description } = body;

        if (!url || !filename) {
            return new NextResponse("Missing required fields", { status: 400 });
        }

        if (!isValidHttpUrl(url)) {
            return new NextResponse("Invalid URL: Only http(s) URLs are allowed", { status: 400 });
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
                userId: session.user.id,
            },
        });

        await logActivity("Uploaded Media", "Media", `Uploaded ${filename}`);

        return NextResponse.json(mediaItem);
    } catch (error) {
        systemLogger.error("[MEDIA_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) {
            return error || new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const onlyPublic = searchParams.get("public") === "true";
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
        const skip = (page - 1) * limit;

        const andConditions: any[] = [];

        if (!teamInfo.isGlobalAdmin) {
            const allowedUserIds = await getScopedTeamUserIds(teamInfo.teamId, session.user.id);
            andConditions.push({ userId: { in: allowedUserIds } });
        }

        if (search) {
            andConditions.push({
                OR: [
                    { filename: { contains: search, mode: "insensitive" } },
                    { title: { contains: search, mode: "insensitive" } },
                    { description: { contains: search, mode: "insensitive" } },
                ],
            });
        }

        if (onlyPublic) {
            andConditions.push({ isPublic: true });
        }

        const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

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
        systemLogger.error("[MEDIA_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) {
            return error || new NextResponse("Unauthorized", { status: 401 });
        }

        if (!teamInfo.isAdmin) {
            return new NextResponse("Forbidden: Admin access required", { status: 403 });
        }

        const body = await req.json();
        const { id, title, caption, altText, description, isPublic } = body;

        if (!id) {
            return new NextResponse("ID required", { status: 400 });
        }

        const existing = await (prismadb as any).mediaItem.findUnique({ where: { id } });
        if (!existing) {
            return new NextResponse("Not Found", { status: 404 });
        }

        if (!teamInfo.isPlatformAdmin) {
            const allowedUserIds = await getScopedTeamUserIds(teamInfo.teamId, session.user.id);
            if (!existing.userId || !allowedUserIds.includes(existing.userId)) {
                return new NextResponse("Forbidden", { status: 403 });
            }
        }

        const dataToUpdate: any = {
            title,
            caption,
            altText,
            description,
        };

        if (typeof isPublic !== "undefined") {
            dataToUpdate.isPublic = isPublic;
        }

        const mediaItem = await (prismadb as any).mediaItem.update({
            where: { id },
            data: dataToUpdate,
        });

        await logActivity("Updated Media", "Media", `Updated metadata for ${id}`);

        return NextResponse.json(mediaItem);
    } catch (error) {
        systemLogger.error("[MEDIA_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user?.id || !teamInfo) {
            return error || new NextResponse("Unauthorized", { status: 401 });
        }

        if (!teamInfo.isAdmin) {
            return new NextResponse("Forbidden: Admin access required", { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return new NextResponse("ID required", { status: 400 });
        }

        const existing = await (prismadb as any).mediaItem.findUnique({ where: { id } });
        if (!existing) {
            return new NextResponse("Not Found", { status: 404 });
        }

        if (!teamInfo.isPlatformAdmin) {
            const allowedUserIds = await getScopedTeamUserIds(teamInfo.teamId, session.user.id);
            if (!existing.userId || !allowedUserIds.includes(existing.userId)) {
                return new NextResponse("Forbidden", { status: 403 });
            }
        }

        await (prismadb as any).mediaItem.delete({
            where: { id },
        });

        await logActivity("Deleted Media", "Media", `Deleted asset ${id}`);

        return new NextResponse("Deleted", { status: 200 });
    } catch (error) {
        systemLogger.error("[MEDIA_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
