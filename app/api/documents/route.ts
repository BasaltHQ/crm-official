import { NextResponse } from "next/server";
import { getDocuments } from "@/actions/documents/get-documents";
import { requireApiAuth } from "@/lib/api-auth-guard";

export async function GET() {
  // ── Auth guard ──
  const session = await requireApiAuth();
  if (session instanceof Response) return session;

    try {
        const documents = await getDocuments();
        return NextResponse.json({ documents });
    } catch (error) {
        console.error("[DOCUMENTS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
