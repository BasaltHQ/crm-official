import { NextRequest, NextResponse } from "next/server";
import { getBlobServiceClient } from "@/lib/s3-storage";
import { getSessionAndTeam } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

/**
 * GET /api/media/:key
 * Hardened S3 proxy. Public unauthenticated inline streaming is strictly restricted
 * to safe raster extensions under PUBLIC_RASTER_PREFIXES. All other keys require
 * authenticated tenant ownership verification and force attachment disposition for non-raster files.
 */
export const dynamic = "force-dynamic";

const PUBLIC_RASTER_PREFIXES = [
  "avatars/",
  "logos/",
  "banners/",
  "email-assets/",
  "brand/",
];

const RASTER_EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

const PRIVATE_DOC_EXT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  md: "text/plain; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function normalizeAndValidateKey(keyParts: string[] | undefined): string | null {
  if (!Array.isArray(keyParts) || keyParts.length === 0) return null;
  const raw = keyParts.join("/");
  if (!raw || raw.startsWith("/") || raw.includes("..") || raw.includes("\\") || raw.includes("\0")) {
    return null;
  }
  try {
    const decoded = decodeURIComponent(raw);
    if (
      !decoded ||
      decoded.startsWith("/") ||
      decoded.includes("..") ||
      decoded.includes("\\") ||
      decoded.includes("\0")
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const { key: keyParts } = await params;
    const key = normalizeAndValidateKey(keyParts);

    if (!key) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 });
    }

    const ext = key.split(".").pop()?.toLowerCase() || "";
    const isPublicRasterPrefix = PUBLIC_RASTER_PREFIXES.some((prefix) => key.startsWith(prefix));
    const isRasterExt = Object.prototype.hasOwnProperty.call(RASTER_EXT_MIME, ext);

    if (isPublicRasterPrefix && isRasterExt) {
      const serviceClient = getBlobServiceClient();
      const presignedUrl = await serviceClient.getPresignedUrl(key, 300);
      const s3Res = await fetch(presignedUrl);
      if (!s3Res.ok) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const body = await s3Res.arrayBuffer();

      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": RASTER_EXT_MIME[ext],
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Cache-Control": "public, max-age=31536000, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // All non-public or non-raster objects require authenticated tenant access
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error || !session?.user?.id || !teamInfo) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let authorized = Boolean(teamInfo.isPlatformAdmin) || key.startsWith(`uploads/${session.user.id}/`);
    if (!authorized && teamInfo.teamId) {
      const doc = await prismadb.documents.findFirst({
        where: { key, team_id: teamInfo.teamId },
        select: { id: true },
      });
      authorized = Boolean(doc);
    }

    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceClient = getBlobServiceClient();
    const presignedUrl = await serviceClient.getPresignedUrl(key, 300);
    const s3Res = await fetch(presignedUrl);
    if (!s3Res.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await s3Res.arrayBuffer();
    const contentType = isRasterExt
      ? RASTER_EXT_MIME[ext]
      : PRIVATE_DOC_EXT_MIME[ext] || "application/octet-stream";

    const safeFileName = (key.split("/").pop() || "download").replace(/[^a-zA-Z0-9._-]/g, "_");
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=300",
    };

    if (!isRasterExt) {
      headers["Content-Disposition"] = `attachment; filename="${safeFileName}"`;
    }

    return new NextResponse(body, {
      status: 200,
      headers,
    });
  } catch (e: any) {
    console.error("[MEDIA_PROXY]", e?.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
