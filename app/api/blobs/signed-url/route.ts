import { NextRequest, NextResponse } from "next/server";
import { getBlobServiceClient } from "@/lib/s3-storage";
import { systemLogger } from "@/lib/logger";
import { getSessionAndTeam } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

// POST /api/blobs/signed-url
// Returns a time-limited signed URL for an S3 object. Accepts JSON body:
// { key?: string, url?: string, ttlSeconds?: number }
// SOC2 Update: Transitioned from Azure SAS to S3 Presigned URLs with strict tenant authorization.
export async function POST(req: NextRequest) {
  try {
    const { error, session, teamInfo } = await getSessionAndTeam();
    if (error || !session?.user?.id || !teamInfo) {
      return error || NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const key: string | undefined = typeof body?.key === "string" ? body.key : undefined;
    const urlStr: string | undefined = typeof body?.url === "string" ? body.url : undefined;
    const ttlSeconds: number = Math.max(60, Math.min(3600, Number(body?.ttlSeconds) || 900));

    // Determine path/key from key or URL
    let objectKey: string | undefined = key;
    if (!objectKey && urlStr) {
      try {
        const u = new URL(urlStr);
        const s3BucketName = process.env.S3_BUCKET_NAME || "basaltcrm";
        const parts = u.pathname.split("/").filter(Boolean);

        if (parts.length > 0) {
          if (parts[0] === s3BucketName) {
            objectKey = decodeURIComponent(parts.slice(1).join("/"));
          } else {
            objectKey = decodeURIComponent(parts.join("/"));
          }
        }
      } catch {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
    }

    if (
      !objectKey ||
      objectKey.startsWith("/") ||
      objectKey.includes("..") ||
      objectKey.includes("\\") ||
      objectKey.includes("\0")
    ) {
      return NextResponse.json({ error: "Missing or invalid key" }, { status: 400 });
    }

    let authorized =
      Boolean(teamInfo.isPlatformAdmin) ||
      objectKey.startsWith("avatars/") ||
      objectKey.startsWith(`uploads/${session.user.id}/`);

    if (!authorized && teamInfo.teamId) {
      const doc = await prismadb.documents.findFirst({
        where: { key: objectKey, team_id: teamInfo.teamId },
        select: { id: true },
      });
      authorized = Boolean(doc);
    }

    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const service = getBlobServiceClient();
    const signedUrl = await service.getPresignedUrl(objectKey, ttlSeconds);

    return NextResponse.json({ url: signedUrl, key: objectKey }, { status: 200 });
  } catch (e: any) {
    systemLogger.error("[S3_SIGNED_URL_POST]", e);
    return NextResponse.json({ error: e?.message || "Internal Error" }, { status: 500 });
  }
}
