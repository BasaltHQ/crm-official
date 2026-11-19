import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { prismadb } from "@/lib/prisma";

export async function GET() {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const user = await prismadb.users.findUnique({
        where: { id: session.user.id },
        select: {
            mfaEnabled: true,
            mfaMethod: true,
            mfaSecret: true,
        },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if authenticators (passkeys) exist
    const authenticatorCount = await prismadb.authenticator.count({
        where: { userId: session.user.id },
    });

    return NextResponse.json({
        mfaEnabled: user.mfaEnabled,
        mfaMethod: user.mfaMethod,
        totpConfigured: !!user.mfaSecret,
        webauthnConfigured: authenticatorCount > 0,
    });
}
