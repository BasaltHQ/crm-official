import { NextResponse } from "next/server";
import { getDocuments } from "@/actions/documents/get-documents";

export async function GET() {
    try {
        const documents = await getDocuments();
        return NextResponse.json({ documents });
    } catch (error) {
        console.error("[DOCUMENTS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
