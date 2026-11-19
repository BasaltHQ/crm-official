import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { NextResponse } from "next/server";
import { systemLogger } from "@/lib/logger";

export async function DELETE(req: Request, props: { params: Promise<{ documentId: string }> }) {
  const params = await props.params;
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  try {
    if (!params.documentId) {
      return new NextResponse("Document ID not found", { status: 404 });
    }

    const document = await prismadb.documents.findUnique({
      where: {
        id: params.documentId,
      },
    });

    if (!document) {
      return new NextResponse("Document in DB not found", { status: 404 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, document.team_id, teamInfo!.isPlatformAdmin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const deletedDocument = await prismadb.documents.delete({
      where: {
        id: params.documentId,
      },
    });

    console.log("Document deleted:", deletedDocument);

    // If it's a stored file, delete from storage too; otherwise skip (link-only docs)
    const key = (document as any)?.key as string | undefined;
    if (key) {
      const { deleteBlobIfConfigured } = await import("@/lib/s3-blob");
      await deleteBlobIfConfigured(key);
    }

    return NextResponse.json("deletedDocument");
  } catch (error) {
    systemLogger.error("[Document_DELETE]", error);
    return new NextResponse("Initial error", { status: 500 });
  }
}
