import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

/**
 * GET /api/projects/[projectId]/summary
 * Returns project (Board) summary fields for composing prompts:
 * {
 *   id: string,
 *   title: string,
 *   description: string,
 *   brand_logo_url?: string,
 *   brand_primary_color?: string
 * }
 */
export async function GET(_req: Request, props: { params: Promise<{ projectId: string }> }) {
    try {
        const params = await props.params;
        const { projectId } = params;
        if (!projectId) {
            return new NextResponse("Missing projectId", { status: 400 });
        }

        // Mongo ObjectId string is stored in Boards.id; Prisma can query directly by id
        const board = await (prismadb as any).Boards.findUnique({
            where: { id: projectId },
            select: {
                id: true,
                title: true,
                description: true,
                brand_logo_url: true,
                brand_primary_color: true,
            },
        });

        if (!board) {
            return new NextResponse("Project not found", { status: 404 });
        }

        return NextResponse.json(
            {
                id: String(board.id || ""),
                title: String(board.title || ""),
                description: String(board.description || ""),
                brand_logo_url: board.brand_logo_url || "",
                brand_primary_color: board.brand_primary_color || "",
            },
            { status: 200 },
        );
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[PROJECT_SUMMARY_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
