import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { BlobServiceClient } from "@azure/storage-blob";
import { getCurrentUserTeamId } from "@/lib/team-utils";

// POST /api/documents/upload
// Generic Azure Blob upload for documents (not tied to a project).
// Accepts multipart/form-data with field "file".
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const conn = process.env.BLOB_STORAGE_CONNECTION_STRING;
    const container = process.env.BLOB_STORAGE_CONTAINER;
    if (!conn || !container) {
      return NextResponse.json({ error: "Azure Blob not configured" }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileNameSafe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `documents/${session.user.id}/${Date.now()}_${fileNameSafe}`;

    const serviceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = serviceClient.getContainerClient(container);
    const blobClient = containerClient.getBlockBlobClient(key);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type || "application/octet-stream" },
    });
    const fileUrl = blobClient.url;

    const teamInfo = await getCurrentUserTeamId();
    const teamId = teamInfo?.teamId;

    const doc = await (prismadb.documents as any).create({
      data: {
        document_name: file.name,
        document_file_mimeType: file.type || "application/octet-stream",
        document_file_url: fileUrl,
        team_id: teamId, // Assign team
        status: "ACTIVE",
        assigned_user: session.user.id,
        key,
        size: buffer.length,
      },
    });

    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (e: any) {
    console.error("[DOCUMENTS_UPLOAD_POST]", e);
    return NextResponse.json({ error: e?.message || "Internal Error" }, { status: 500 });
  }
}
