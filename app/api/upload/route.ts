import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getBlobServiceClient } from "@/lib/s3-storage";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

// POST /api/upload
// Generic Azure Blob upload endpoint used by Invoice FileInput and other generic uploads.
// Accepts multipart/form-data with field "file".

// Body size limit is set in next.config.js
export const maxDuration = 30; // Allow up to 30s for large uploads
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    // SOC2 Type 1 / 2 Control: Enforce strict extension + canonical MIME allowlist to prevent XSS/RCE/Malware
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

    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "text/csv",
      "text/markdown",
      "application/json",
      "text/plain",
      "application/octet-stream",
    ];

    const fileExt = file.name?.split('.').pop()?.toLowerCase() || '';
    const allowedExtensions = Object.keys(EXT_TO_MIME);
    const dangerousExtensions = [
      'svg', 'html', 'htm', 'xhtml', 'xml', 'mhtml',
      'exe', 'sh', 'bat', 'cmd', 'ps1',
      'js', 'mjs', 'cjs', 'php', 'py', 'ts', 'jsx', 'tsx',
    ];

    if (dangerousExtensions.includes(fileExt)) {
      return NextResponse.json({ error: "File extension not permitted." }, { status: 400 });
    }

    if (!allowedExtensions.includes(fileExt) || (file.type && !allowedMimeTypes.includes(file.type))) {
      return NextResponse.json({ error: `Invalid file type (${file.type || fileExt}). Only standard documents and raster images are allowed.` }, { status: 400 });
    }

    const canonicalMimeType = EXT_TO_MIME[fileExt] || "application/octet-stream";

    const url = new URL(req.url);
    const context = url.searchParams.get("context");

    const s3Access = process.env.S3_ACCESS_KEY;
    const s3Secret = process.env.S3_SECRET_KEY;
    const container = process.env.S3_BUCKET_NAME || "basaltcrm";
    if (!s3Access || !s3Secret) {
      return NextResponse.json({ error: "S3 Storage not configured" }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Calculate SHA256 hash
    const crypto = require('crypto');
    const hashSum = crypto.createHash('sha256');
    hashSum.update(buffer);
    const hex = hashSum.digest('hex');

    // Check for existing document with same hash in this team
    const teamInfo = await getCurrentUserTeamId();
    const teamId = teamInfo?.teamId;

    // SOC2 CC6.1 / A1.2: Check storage quotas before allowing upload
    if (teamId) {
      const { checkTeamQuota } = await import("@/lib/quota-service");
      const quota = await checkTeamQuota(teamId, "STORAGE", session.user.id);
      if (!quota.allowed) {
        return NextResponse.json({ error: quota.message }, { status: 403 });
      }
    }

    const existingDoc = await (prismadb.documents as any).findFirst({
      where: {
        hash: hex,
        team_id: teamId
      }
    });

    if (existingDoc) {
      systemLogger.error("[GENERIC_UPLOAD_POST] Duplicate document found:", existingDoc.id);

      // FIX: If context is invoice, we MUST process it even if the doc exists
      // The user might be re-uploading because the previous attempt failed to create an invoice
      if (context === "invoice") {
        try {
          systemLogger.error("[GENERIC_UPLOAD_POST] Processing duplicate document for Invoice...");
          const { processInvoiceFromDocument } = await import("@/lib/invoice-processor");
          await processInvoiceFromDocument(existingDoc.id, session.user.id, teamId || null);
          systemLogger.error("[GENERIC_UPLOAD_POST] Invoice Processing Complete (Duplicate Doc).");
        } catch (err) {
          systemLogger.error("[GENERIC_UPLOAD_POST] Duplicate processing failed:", err);
          throw new Error("Invoice processing failed: " + (err as any).message);
        }
      }

      return NextResponse.json({ ok: true, document: existingDoc }, { status: 200 });
    }

    const fileNameSafe = file.name?.replace(/[^a-zA-Z0-9._-]/g, "_") || `upload_${Date.now()}`;
    const key = `uploads/${session.user.id}/${Date.now()}_${fileNameSafe}`;

    const serviceClient = getBlobServiceClient();
    const containerClient = serviceClient.getContainerClient(container);
    // Ensure container exists; do not change access level here
    try {
      const ensure = await containerClient.createIfNotExists();
      if (ensure.succeeded) systemLogger.info("[GENERIC_UPLOAD_POST] Container created:", container);
    } catch (e) {
      console.warn("[GENERIC_UPLOAD_POST] createIfNotExists error:", (e as any)?.message);
    }

    const blobClient = containerClient.getBlockBlobClient(key);
    systemLogger.info("[GENERIC_UPLOAD_POST] Uploading blob", { key, type: canonicalMimeType, size: buffer.length });
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: canonicalMimeType },
    });
    const fileUrl = blobClient.url;
    systemLogger.info("[GENERIC_UPLOAD_POST] Uploaded blob URL:", fileUrl);

    // Create Document record (generic)
    const doc = await (prismadb.documents as any).create({
      data: {
        document_name: file.name || fileNameSafe,
        document_file_mimeType: canonicalMimeType,
        document_file_url: fileUrl,
        team_id: teamId, // Assign team
        status: "ACTIVE",
        assigned_user: session.user.id,
        key,
        size: buffer.length,
        hash: hex,
      },
    });
    systemLogger.info("[GENERIC_UPLOAD_POST] Document created:", doc);

    // Handle context-specific actions
    // Handle context-specific actions
    if (context === "invoice") {
      // Run SYNCHRONOUSLY so the client waits for the invoice to be created
      try {
        systemLogger.error("[GENERIC_UPLOAD_POST] Starting Invoice Processing...");
        const { processInvoiceFromDocument } = await import("@/lib/invoice-processor");
        await processInvoiceFromDocument(doc.id, session.user.id, teamId || null);
        systemLogger.error("[GENERIC_UPLOAD_POST] Invoice Processing Complete.");
      } catch (err) {
        systemLogger.error("[GENERIC_UPLOAD_POST] Invoice processing failed:", err);
        // We might want to return a warning, but for now strict error is safer to debug
        throw new Error("Invoice processing failed: " + (err as any).message);
      }
    }

    await logActivityInternal(session.user.email || "SYSTEM", "CREATE", "Documents", `Uploaded generic document: ${fileNameSafe}`, teamId || "");
    return NextResponse.json({ ok: true, document: doc }, { status: 201 });
  } catch (e: any) {
    systemLogger.error("[GENERIC_UPLOAD_POST]", e);
    return NextResponse.json({ error: e?.message || "Internal Error" }, { status: 500 });
  }
}
