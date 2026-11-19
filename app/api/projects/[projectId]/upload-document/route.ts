import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getBlobServiceClient } from "@/lib/s3-storage";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { checkTeamQuota } from "@/lib/quota-service";
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

// POST /api/projects/[projectId]/upload-document
// Accepts multipart/form-data { file } and uploads to S3 Storage,
// creates a "Documents" section and task if needed, and attaches a Document record.
export async function POST(req: NextRequest, ctx: { params: Promise<{ projectId: string }> }) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error || !session?.user?.id || !teamInfo) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await ctx.params;
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 });

    const board = await prismadb.boards.findUnique({
      where: { id: projectId },
      select: { id: true, team_id: true },
    });
    if (!board) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (!validateResourceOwnership(teamInfo.teamId, board.team_id, teamInfo.isPlatformAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const effectiveTeamId = board.team_id || teamInfo.teamId;

    if (effectiveTeamId) {
      const quota = await checkTeamQuota(effectiveTeamId, "STORAGE", session.user.id);
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

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileNameSafe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `projects/${projectId}/${Date.now()}_${fileNameSafe}`;

    // Upload to S3
    const serviceClient = getBlobServiceClient();
    const containerClient = serviceClient.getContainerClient(container);
    const blobClient = containerClient.getBlockBlobClient(key);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: canonicalMimeType },
    });
    const fileUrl = blobClient.url;

    // Ensure a "Documents" section exists for this project
    let docsSection = await prismadb.sections.findFirst({
      where: { board: projectId, title: "Documents" },
      select: { id: true },
    });
    if (!docsSection) {
      docsSection = await prismadb.sections.create({
        data: { board: projectId, title: "Documents", position: 0, v: 0 },
        select: { id: true },
      });
    }

    // Create a task to anchor the document
    const task = await prismadb.tasks.create({
      data: {
        title: file.name,
        content: null,
        position: 0,
        priority: "Normal",
        section: docsSection.id,
        user: session.user.id,
        team_id: effectiveTeamId || undefined,
        v: 0,
      },
      select: { id: true },
    });

    // Create the document record and attach to the task
    const doc = await prismadb.documents.create({
      data: {
        document_name: file.name,
        document_file_mimeType: canonicalMimeType,
        document_file_url: fileUrl,
        team_id: effectiveTeamId || undefined,
        key,
        size: buffer.length,
        status: "ACTIVE",
        assigned_user: session.user.id,
        tasksIDs: [task.id],
      },
    });

    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (e: any) {
    systemLogger.error("[PROJECT_UPLOAD_DOCUMENT_POST]", e);
    return NextResponse.json({ error: e?.message || "Internal Error" }, { status: 500 });
  }
}
