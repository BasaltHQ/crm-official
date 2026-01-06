import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const body = await req.json();
        const { submissionId, status } = body;

        if (!submissionId || !status) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        const submission = await prismadb.formSubmission.findUnique({
            where: { id: submissionId }
        });

        if (!submission) {
            return NextResponse.json({ error: "Submission not found" }, { status: 404 });
        }

        const updated = await prismadb.formSubmission.update({
            where: { id: submissionId },
            data: { status: status }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("[SUBMISSION_UPDATE]", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
