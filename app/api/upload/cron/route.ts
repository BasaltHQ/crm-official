import { NextRequest, NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { prismadb } from "@/lib/prisma";
import type { DocumentSystemType } from "@prisma/client";

// POST /api/upload/cron
// Used by the email ingestion job to upload attachments to Azure Blob and create a Document record.
// Accepts JSON payload: { file: { filename, contentType, size, content } }
// Where `content` may be serialized Buffer: { type: 'Buffer', data: number[] } or base64 string.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as any;
    const file = body?.file;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const filename: string = file.filename || `attachment_${Date.now()}`;
    const contentType: string = file.contentType || "application/octet-stream";
    const size: number | undefined = file.size;
    let buffer: Buffer | null = null;

    // Reconstruct content buffer from common JSON-serialized forms
    const content = file.content;
    if (content && typeof content === "object" && content.type === "Buffer" && Array.isArray(content.data)) {
      buffer = Buffer.from(content.data);
    } else if (typeof content === "string") {
      // try base64
      try { buffer = Buffer.from(content, "base64"); } catch { /* ignore */ }
    }

    if (!buffer) {
      return NextResponse.json({ error: "Invalid or unsupported attachment content" }, { status: 400 });
    }

    const conn = process.env.BLOB_STORAGE_CONNECTION_STRING;
    const container = process.env.BLOB_STORAGE_CONTAINER;
    if (!conn || !container) {
      return NextResponse.json({ error: "Azure Blob not configured" }, { status: 500 });
    }

    const fileNameSafe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `uploads/cron/${Date.now()}_${fileNameSafe}`;

    const serviceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = serviceClient.getContainerClient(container);
    const blobClient = containerClient.getBlockBlobClient(key);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
    const fileUrl = blobClient.url;

    // Determine document system type heuristically
    const inferredType: DocumentSystemType = (contentType?.includes("pdf")) ? "INVOICE" : "OTHER";

    const doc = await prismadb.documents.create({
      data: {
        document_name: filename,
        document_file_mimeType: contentType,
        document_file_url: fileUrl,
        status: "ACTIVE",
        key,
        size: buffer.length ?? size,
        document_system_type: inferredType,
      },
    });

    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (e: any) {
    console.error("[GENERIC_UPLOAD_CRON_POST]", e);
    const debug = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      debug ? { error: e?.message || "Internal Error", stack: e?.stack } : { error: "Internal Error" },
      { status: 500 }
    );
  }
}
