import { authOptions } from "@/lib/auth";
import { getBlobServiceClient } from "@/lib/azure-storage";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

//Get single invoice data
export async function GET(request: Request, props: { params: Promise<{ invoiceId: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({ invoice }, { status: 200 });
}

//Delete single invoice by invoiceId
export async function DELETE(request: Request, props: { params: Promise<{ invoiceId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  try {
    // 1. Attempt to delete from Azure Blob Storage (Best Effort)
    if (invoiceData?.invoice_file_url) {
      try {
        const connectionString = process.env.BLOB_STORAGE_CONNECTION_STRING;
        const containerName = process.env.BLOB_STORAGE_CONTAINER;

        if (connectionString && containerName) {
          const blobServiceClient = getBlobServiceClient();
          const containerClient = blobServiceClient.getContainerClient(containerName);

          const parts = invoiceData.invoice_file_url.split('/');
          const blobName = parts[parts.length - 1];

          if (blobName) {
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.deleteIfExists();
            console.log("[DELETE] Deleted blob from Azure:", blobName);
          }
        }
      } catch (fileErr) {
        console.error("[DELETE] Failed to delete file from Azure (non-fatal):", fileErr);
      }
    }

    // 2. Delete invoice from database
    // Use deleteMany to avoid P2025 errors if record vanished.
    await prismadb.invoices.deleteMany({
      where: {
        id: invoiceId,
      },
    });
    console.log("[DELETE] Invoice deleted from database:", invoiceId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    console.error("[DELETE] Error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong while deleting invoice" },
      { status: 500 }
    );
  }
}
