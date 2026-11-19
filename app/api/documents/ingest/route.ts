import { NextResponse } from "next/server";
import { ingestDocument } from "@/lib/document-rag";
import { systemLogger } from "@/lib/logger";
import { getSessionAndTeam } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/documents/ingest
 *
 * Triggers document ingestion for RAG (text extraction, chunking, embedding).
 * Body: { documentId: string } or { documentIds: string[] }
 */
export async function POST(req: Request) {
  try {
    const { error, teamInfo } = await getSessionAndTeam();
    if (error || !teamInfo) {
      return error || new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const rawIds: unknown[] = Array.isArray(body.documentIds)
      ? body.documentIds
      : body.documentId
      ? [body.documentId]
      : [];
    const ids = Array.from(
      new Set(rawIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
    );

    if (ids.length === 0) {
      return new NextResponse("No document IDs provided", { status: 400 });
    }

    const effectiveTeamId =
      teamInfo.isPlatformAdmin && typeof body.teamId === "string" && body.teamId
        ? body.teamId
        : teamInfo.teamId;

    if (!effectiveTeamId && !teamInfo.isPlatformAdmin) {
      return new NextResponse("Forbidden: No team context", { status: 403 });
    }

    if (!teamInfo.isPlatformAdmin) {
      const ownedDocs = await prismadb.documents.findMany({
        where: { id: { in: ids }, team_id: effectiveTeamId! },
        select: { id: true },
      });
      if (ownedDocs.length !== ids.length) {
        return new NextResponse("Forbidden: Unauthorized document access", { status: 403 });
      }
    }

    const results: Array<{ documentId: string; status: string; chunks?: number; textLength?: number; error?: string }> = [];

    for (const docId of ids) {
      try {
        const result = await ingestDocument(docId, effectiveTeamId || undefined);
        results.push({
          documentId: docId,
          status: "ingested",
          chunks: result.chunksCreated,
          textLength: result.textLength,
        });
      } catch (err: any) {
        systemLogger.warn(`[DOC_INGEST] Failed for ${docId}: ${err?.message}`);
        results.push({
          documentId: docId,
          status: "error",
          error: err?.message || "Ingestion failed",
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalIngested: results.filter((r) => r.status === "ingested").length,
    });
  } catch (error: any) {
    systemLogger.error("[DOC_INGEST_POST]", error?.message);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
