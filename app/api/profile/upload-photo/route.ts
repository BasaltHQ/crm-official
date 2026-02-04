import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { validateImageFile } from "@/lib/image-processing";
import { getBlobServiceClient } from "@/lib/azure-storage";

// Migrate profile photo upload to Azure Blob
// POST /api/profile/upload-photo
// Accepts multipart/form-data { file } and uploads to Azure Blob Storage, then stores the blob URL in Users.avatar
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type and size
    try {
      validateImageFile(file.type, file.size);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const conn = process.env.BLOB_STORAGE_CONNECTION_STRING;
    const container = process.env.BLOB_STORAGE_CONTAINER;
    if (!conn || !container) {
      return NextResponse.json({ error: "Azure Blob not configured" }, { status: 500 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate safe key and upload
    const fileNameSafe = file.name?.replace(/[^a-zA-Z0-9._-]/g, "_") || `avatar_${Date.now()}`;
    const key = `avatars/${session.user.id}/${Date.now()}_${fileNameSafe}`;

    const serviceClient = getBlobServiceClient();
    const containerClient = serviceClient.getContainerClient(container);
    const blobClient = containerClient.getBlockBlobClient(key);
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: file.type || "image/png" },
    });

    const fileUrl = blobClient.url;

    // Update user's avatar in database to point to Azure Blob URL
    await prismadb.users.update({
      where: { id: session.user.id },
      data: { avatar: fileUrl },
    });

    return NextResponse.json(
      { success: true, avatar: fileUrl, message: "Profile photo updated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[PROFILE_UPLOAD_PHOTO_ERROR]", error);
    return NextResponse.json({ error: error?.message || "Failed to upload profile photo" }, { status: 500 });
  }
}
