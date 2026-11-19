import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { validateImageFile } from "@/lib/image-processing";
import { getBlobServiceClient } from "@/lib/s3-storage";
import { systemLogger } from "@/lib/logger";

const ALLOWED_RASTER_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function detectRasterMimeFromMagicBytes(buffer: Buffer): { mime: string; ext: string } | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (buffer.length >= 6) {
    const sig = buffer.subarray(0, 6).toString("ascii");
    if (sig === "GIF87a" || sig === "GIF89a") {
      return { mime: "image/gif", ext: "gif" };
    }
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

// POST /api/profile/upload-photo
// Accepts multipart/form-data { file }, validates raster extension + magic bytes, and uploads to S3.
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const rawExt = file.name?.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_RASTER_EXTS.has(rawExt)) {
      return NextResponse.json(
        { error: "Invalid image extension. Only JPG, PNG, GIF, and WebP files are allowed." },
        { status: 400 }
      );
    }

    // Validate file type and size
    try {
      validateImageFile(file.type, file.size);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const s3Access = process.env.S3_ACCESS_KEY;
    const s3Secret = process.env.S3_SECRET_KEY;
    const container = process.env.S3_BUCKET_NAME || "basaltcrm";
    if (!s3Access || !s3Secret) {
      return NextResponse.json({ error: "S3 Storage not configured" }, { status: 500 });
    }

    // Convert file to buffer and verify raster magic bytes
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const detected = detectRasterMimeFromMagicBytes(buffer);
    if (!detected) {
      return NextResponse.json(
        { error: "Invalid image file content. File failed raster signature verification." },
        { status: 400 }
      );
    }

    // Generate safe key with canonical raster extension and upload
    const baseName = (file.name || "avatar")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 64) || "avatar";
    const key = `avatars/${session.user.id}/${Date.now()}_${baseName}.${detected.ext}`;

    const serviceClient = getBlobServiceClient();
    const containerClient = serviceClient.getContainerClient(container);
    const blobClient = containerClient.getBlockBlobClient(key);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: detected.mime },
    });

    const fileUrl = blobClient.url;

    // Update user's avatar in database to point to S3 URL
    await prismadb.users.update({
      where: { id: session.user.id },
      data: { avatar: fileUrl },
    });

    return NextResponse.json(
      { success: true, avatar: fileUrl, message: "Profile photo updated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    systemLogger.error("[PROFILE_UPLOAD_PHOTO_ERROR]", error);
    return NextResponse.json({ error: error?.message || "Failed to upload profile photo" }, { status: 500 });
  }
}
