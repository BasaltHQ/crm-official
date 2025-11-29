import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function DELETE(req: Request, props: { params: Promise<{ documentId: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session) {
    return new NextResponse("Unauthenticated", { status: 401 });
  }

  try {
    if (!params.documentId)
      return new NextResponse("Document ID not found", { status: 404 });

    const document = await prismadb.documents.findMany({
      where: {
        id: params.documentId,
      },
    });

    if (!document) {
      return new NextResponse("Document in DB not found", { status: 404 });
    }

    //console.log(document[0].key, "document to delete");

    const deletedDocument = await prismadb.documents.delete({
      where: {
        id: params.documentId,
      },
    });

    console.log("Document deleted:", deletedDocument);

    // If it's a stored file, delete from storage too; otherwise skip (link-only docs)
    const key = (document[0] as any)?.key as string | undefined;
    if (key) {
      const { deleteBlobIfConfigured } = await import("@/lib/azure-blob");
      await deleteBlobIfConfigured(key);
    }

    return NextResponse.json("deletedDocument");
  } catch (error) {
    console.log("[Document_DELETE]", error);
    return new NextResponse("Initial error", { status: 500 });
  }
}
