import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { logActivityInternal } from "@/actions/audit";
import { systemLogger } from "@/lib/logger";

export async function POST() {
    try {
        const session = await requireApiAuth();
        if (session instanceof NextResponse) return session;

        const user = await prismadb.users.findUnique({
            where: { id: session.user.id }
        });

        if (!user) {
            return new NextResponse("User not found", { status: 404 });
        }

        await (prismadb.users as any).update({
            where: { id: user.id },
            data: {
                termsAccepted: true,
                termsAcceptedAt: new Date()
            }
        });

        // SOC2 Compliance: Log that the user actually accepted the terms at this timestamp
        await logActivityInternal(
            user.id,
            "TERMS_ACCEPTED",
            "Compliance",
            `User accepted the Terms of Service and Privacy Policy.`,
            user.team_id || undefined
        );

        return NextResponse.json({ success: true, message: "Terms accepted successfully" });
    } catch (error) {
        systemLogger.error("[ACCEPT_TERMS_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
