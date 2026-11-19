import { getBlobServiceClient } from "@/lib/s3-storage";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { systemLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

//Get single invoice data
export async function GET(request: Request, props: { params: Promise<{ invoiceId: string }> }) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const { invoiceId } = await props.params;

  if (!invoiceId) {
    return NextResponse.json({ error: "Bad Request - invoice id is mandatory" }, { status: 400 });
  }

  const invoice = await prismadb.invoices.findUnique({
    where: {
      id: invoiceId,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!validateResourceOwnership(teamInfo!.teamId, invoice.team_id, teamInfo!.isPlatformAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ invoice }, { status: 200 });
}

//Delete single invoice by invoiceId
export async function DELETE(request: Request, props: { params: Promise<{ invoiceId: string }> }) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const { invoiceId } = await props.params;

  if (!invoiceId) {
    return NextResponse.json({ error: "Bad Request - invoice id is mandatory" }, { status: 400 });
  }

  const invoiceData = await prismadb.invoices.findUnique({
    where: {
      id: invoiceId,
    },
  });

  if (!invoiceData) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!validateResourceOwnership(teamInfo!.teamId, invoiceData.team_id, teamInfo!.isPlatformAdmin)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // 1. Attempt to delete from Azure Blob Storage (Best Effort)
    if (invoiceData?.invoice_file_url) {
      try {
        const s3Access = process.env.S3_ACCESS_KEY;
        const s3Secret = process.env.S3_SECRET_KEY;
        const containerName = process.env.S3_BUCKET_NAME || "basaltcrm";

        if (s3Access && s3Secret) {
          const blobServiceClient = getBlobServiceClient();
          const containerClient = blobServiceClient.getContainerClient(containerName);

          const parts = invoiceData.invoice_file_url.split('/');
          const blobName = parts[parts.length - 1];

          if (blobName) {
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.deleteIfExists();
            systemLogger.error("[DELETE] Deleted blob from Azure:", blobName);
          }
        }
      } catch (fileErr) {
        systemLogger.error("[DELETE] Failed to delete file from Azure (non-fatal):", fileErr);
      }
    }

    // 2. Delete invoice from database
    // Use deleteMany to avoid P2025 errors if record vanished.
    await prismadb.invoices.deleteMany({
      where: {
        id: invoiceId,
      },
    });
    systemLogger.error("[DELETE] Invoice deleted from database:", invoiceId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    systemLogger.error("[DELETE] Error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong while deleting invoice" },
      { status: 500 }
    );
  }
}
