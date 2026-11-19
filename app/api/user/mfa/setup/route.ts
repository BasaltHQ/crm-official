import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";
import { prismadb } from "@/lib/prisma";
import { generateTotpSecret, getTotpAuthUrl, generateQrCodeDataUrl } from "@/lib/mfa-utils";

export async function GET() {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const user = await prismadb.users.findUnique({
        where: { id: session.user.id },
    });

    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const secret = generateTotpSecret();
    const authUrl = getTotpAuthUrl(user.email, secret);
    const qrCode = await generateQrCodeDataUrl(authUrl);

    return NextResponse.json({
        secret,
        qrCode,
        authUrl,
    });
}
