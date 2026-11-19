import { NextResponse } from "next/server";
import { searchDocuments } from "@/lib/document-rag";
import { systemLogger } from "@/lib/logger";
import { getSessionAndTeam } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/documents/search
 *
 * Semantic search across ingested documents, strictly scoped to caller's team.
 */
export async function POST(req: Request) {
  try {
    const { error, teamInfo } = await getSessionAndTeam();
    if (error || !teamInfo) {
      return error || new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();

    if (!body.query || typeof body.query !== "string") {
      return new NextResponse("Query is required", { status: 400 });
    }

    const effectiveTeamId =
      teamInfo.isPlatformAdmin && typeof body.teamId === "string" && body.teamId
        ? body.teamId
        : teamInfo.teamId;

    if (!effectiveTeamId) {
      return new NextResponse("Forbidden: No team context", { status: 403 });
    }

    const requestedDocIds: string[] | undefined = Array.isArray(body.documentIds)
      ? body.documentIds.filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
      : undefined;

    if (requestedDocIds && requestedDocIds.length > 0 && !teamInfo.isPlatformAdmin) {
      const uniqueIds = Array.from(new Set(requestedDocIds));
      const ownedDocs = await prismadb.documents.findMany({
        where: { id: { in: uniqueIds }, team_id: effectiveTeamId },
        select: { id: true },
      });
      if (ownedDocs.length !== uniqueIds.length) {
        return new NextResponse("Forbidden: Unauthorized document access", { status: 403 });
      }
    }

    const results = await searchDocuments(body.query, {
      documentIds: requestedDocIds,
      teamId: effectiveTeamId,
      topK: body.topK,
      minScore: body.minScore,
    });

    return NextResponse.json({
      success: true,
      results,
      totalResults: results.length,
    });
  } catch (error: any) {
    systemLogger.error("[DOC_SEARCH_POST]", error?.message);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
