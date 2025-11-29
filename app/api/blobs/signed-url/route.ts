import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

// POST /api/blobs/signed-url
// Returns a time-limited read SAS URL for a blob. Accepts JSON body:
// { key?: string, url?: string, ttlSeconds?: number }
// - key: blob path within the container (e.g., "uploads/<userId>/<file>")
// - url: full blob URL; server will parse the blob name from the path
// - ttlSeconds: optional lifetime for SAS (default 86400 = 24h)
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const key: string | undefined = body?.key;
    const urlStr: string | undefined = body?.url;
    const ttlSeconds: number = Math.max(60, Math.min(7 * 24 * 3600, Number(body?.ttlSeconds) || 24 * 3600));

    const accountName = process.env.BLOB_STORAGE_ACCOUNT;
    const accountKey = process.env.BLOB_STORAGE_API_KEY;
    const containerName = process.env.BLOB_STORAGE_CONTAINER;
    const endpointSuffix = (process.env.BLOB_STORAGE_ENDPOINT_SUFFIX || "core.windows.net").replace(/^\./, "");

    if (!accountName || !accountKey || !containerName) {
      return NextResponse.json({ error: "Azure Blob not fully configured" }, { status: 500 });
    }

    // Determine blobName from key or URL
    let blobName: string | undefined = key;
    if (!blobName && urlStr) {
      try {
        const u = new URL(urlStr);
        // path: /<container>/<blob>
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts.length >= 2) {
          const containerFromUrl = parts[0];
          const blobParts = parts.slice(1);
          if (containerFromUrl !== containerName) {
            // If the URL container differs from configured one, still attempt to use it
            // but use configured containerName to generate SAS. Typically they should match.
          }
          blobName = blobParts.join("/");
        }
      } catch (e) {
        return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
      }
    }

    if (!blobName) {
      return NextResponse.json({ error: "Missing key or url" }, { status: 400 });
    }

    const startsOn = new Date(Date.now() - 5 * 60 * 1000); // backdate to allow clock skew
    const expiresOn = new Date(Date.now() + ttlSeconds * 1000);

    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const permissions = BlobSASPermissions.parse("r");
    const sas = generateBlobSASQueryParameters(
      {
        containerName,
        blobName,
        permissions,
        startsOn,
        expiresOn,
      },
      credential
    ).toString();

    const signedUrl = `https://${accountName}.blob.${endpointSuffix}/${containerName}/${blobName}?${sas}`;
    return NextResponse.json({ url: signedUrl, blobName }, { status: 200 });
  } catch (e: any) {
    console.error("[BLOB_SIGNED_URL_POST]", e);
    return NextResponse.json({ error: e?.message || "Internal Error" }, { status: 500 });
  }
}
