import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

/**
 * POST /api/user/freemail-acknowledge
 * Marks the freemail warning as acknowledged so the user can proceed to the dashboard.
 */
export async function POST() {
    try {
        const session = await requireApiAuth();
        if (session instanceof NextResponse) return session;

        await prismadb.users.update({
            where: { id: session.user.id },
            data: { freemailWarningAcknowledged: true }
        });

        systemLogger.info(`[FREEMAIL_ACK] User ${session.user.id} acknowledged freemail warning`);
        return NextResponse.json({ acknowledged: true });
    } catch (error) {
        systemLogger.error("[FREEMAIL_ACK]", error);
        return NextResponse.json({ error: "Failed to acknowledge" }, { status: 500 });
    }
}
