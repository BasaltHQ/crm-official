import { BlobServiceClient } from "@azure/storage-blob";

/**
 * Creates a BlobServiceClient with proper configuration.
 * In development mode, it allows bypassing SSL verification if configured.
 */
export function getBlobServiceClient() {
    const connectionString = process.env.BLOB_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
        throw new Error("BLOB_STORAGE_CONNECTION_STRING is not defined");
    }

    // If in development and we want to allow insecure connections locally
    // This helps when hitting Azure Storage from environments with missing CA certificates.
    if (process.env.NODE_ENV === 'development' || process.env.AZURE_STORAGE_IGNORE_SSL === 'true') {
        // Only set if not already disabled to avoid multiple warnings
        if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
            console.warn("WARNING: SSL certificate verification is disabled for Azure Storage (Local Dev Mode)");
        }
    }

    return BlobServiceClient.fromConnectionString(connectionString);
}
