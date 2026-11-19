import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getBlobServiceClient } from "@/lib/s3-storage";
import { getSessionAndTeam } from "@/lib/api-utils";
import { checkTeamQuota } from "@/lib/quota-service";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
};

const ALLOWED_MIME_TYPES = [
  ...Object.values(EXT_TO_MIME),
  "application/octet-stream",
];

const DANGEROUS_EXTENSIONS = [
  "svg", "html", "htm", "xhtml", "xml", "mhtml",
  "exe", "sh", "bat", "cmd", "ps1",
  "js", "mjs", "cjs", "php", "py", "ts", "jsx", "tsx",
];

// POST /api/documents/upload
// Generic S3 upload for documents (not tied to a project).
// Accepts multipart/form-data with field "file".
export async function POST(req: NextRequest) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error || !session?.user?.id || !teamInfo) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileExt = file.name?.split(".").pop()?.toLowerCase() || "";
    const allowedExtensions = Object.keys(EXT_TO_MIME);

    if (DANGEROUS_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: "File extension not permitted." }, { status: 400 });
    }

    if (!allowedExtensions.includes(fileExt) || (file.type && !ALLOWED_MIME_TYPES.includes(file.type))) {
      return NextResponse.json(
        { error: `Invalid file type (${file.type || fileExt}). Only standard documents and raster images are allowed.` },
        { status: 400 }
      );
    }

    const canonicalMimeType = EXT_TO_MIME[fileExt] || "application/octet-stream";
    const teamId = teamInfo.teamId;

    if (teamId) {
      const quota = await checkTeamQuota(teamId, "STORAGE", session.user.id);
      if (!quota.allowed) {
        return NextResponse.json({ error: quota.message }, { status: 403 });
      }
    }

    const s3Access = process.env.S3_ACCESS_KEY;
    const s3Secret = process.env.S3_SECRET_KEY;
    const container = process.env.S3_BUCKET_NAME || "basaltcrm";
    if (!s3Access || !s3Secret) {
      return NextResponse.json({ error: "S3 Storage not configured" }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileNameSafe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `documents/${session.user.id}/${Date.now()}_${fileNameSafe}`;

    const serviceClient = getBlobServiceClient();
    const containerClient = serviceClient.getContainerClient(container);
    const blobClient = containerClient.getBlockBlobClient(key);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: canonicalMimeType },
    });
    const fileUrl = blobClient.url;

    const doc = await (prismadb.documents as any).create({
      data: {
        document_name: file.name,
        document_file_mimeType: canonicalMimeType,
        document_file_url: fileUrl,
        team_id: teamId, // Assign team
        status: "ACTIVE",
        assigned_user: session.user.id,
        key,
        size: buffer.length,
      },
    });

    await logActivityInternal(session.user.id, "CREATE", "Documents", `Uploaded document: ${file.name} (${doc.id}, ${buffer.length} bytes)`, teamId || undefined);
    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (e: any) {
    systemLogger.error("[DOCUMENTS_UPLOAD_POST]", e);
    return NextResponse.json({ error: e?.message || "Internal Error" }, { status: 500 });
  }
}
