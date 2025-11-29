import { BlobServiceClient } from "@azure/storage-blob";

export async function deleteBlobIfConfigured(key?: string) {
  try {
    if (!key) return { skipped: true, reason: "no-key" };
    const conn = process.env.BLOB_STORAGE_CONNECTION_STRING;
    const container = process.env.BLOB_STORAGE_CONTAINER;
    if (!conn || !container) return { skipped: true, reason: "no-azure-config" };

    const serviceClient = BlobServiceClient.fromConnectionString(conn);
    const containerClient = serviceClient.getContainerClient(container);
    const blobClient = containerClient.getBlobClient(key);

    // deleteIfExists does an existence check internally
    const delRes = await blobClient.deleteIfExists();
    if (!delRes.succeeded && delRes.errorCode === "BlobNotFound") {
      return { skipped: true, reason: "not-found" };
    }
    return { deleted: delRes.succeeded };
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}
