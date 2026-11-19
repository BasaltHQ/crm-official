import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

async function isAllowedRedirectUri(rawUri: string): Promise<boolean> {
    let parsed: URL;
    try {
        parsed = new URL(rawUri);
    } catch {
        return false;
    }

    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.hostname === "localhost" && parsed.protocol === "http:")) {
        return false;
    }

    const allowedOrigins = new Set<string>([
        "https://echo.basalthq.com",
        "https://crm.basalthq.com",
    ]);

    if (process.env.NEXT_PUBLIC_APP_URL) {
        try {
            allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
        } catch { /* ignore */ }
    }

    try {
        const echoService = await prismadb.systemServices.findFirst({
            where: { name: "basaltecho" },
            select: { serviceUrl: true },
        });
        if (echoService?.serviceUrl) {
            allowedOrigins.add(new URL(echoService.serviceUrl).origin);
        }
    } catch { /* ignore */ }

    return allowedOrigins.has(parsed.origin);
}

export async function POST(req: NextRequest) {
    try {
        // Get authenticated user
        const session = await getServerSession(authOptions as any);
        const userId = (session as any)?.user?.id as string | undefined;

        if (!userId || (session as any)?.error === "SessionInvalidated") {
            return NextResponse.json(
                { ok: false, error: "unauthorized", hint: "User must be logged in to CRM" },
                { status: 401 }
            );
        }

        const body = await req.json().catch(() => ({}));
        const clientId = String(body?.clientId || "");
        const redirectUri = String(body?.redirectUri || "");
        const scope = typeof body?.scope === "string" ? body.scope : "softphone:control outreach:write leads:read";
        const codeChallenge = String(body?.codeChallenge || "");
        const challengeMethod = typeof body?.challengeMethod === "string" ? body.challengeMethod : "S256";

        if (!clientId) {
            return NextResponse.json({ ok: false, error: "missing_client_id" }, { status: 400 });
        }
        if (!redirectUri) {
            return NextResponse.json({ ok: false, error: "missing_redirect_uri" }, { status: 400 });
        }
        if (!(await isAllowedRedirectUri(redirectUri))) {
            return NextResponse.json({ ok: false, error: "invalid_redirect_uri" }, { status: 400 });
        }
        if (!codeChallenge) {
            return NextResponse.json({ ok: false, error: "missing_code_challenge" }, { status: 400 });
        }

        // Generate a cryptographically secure authorization code
        const code = `auth_${crypto.randomBytes(32).toString("hex")}`;

        // Store the code with user context and PKCE challenge
        // Expire in 10 minutes
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await prismadb.oauth_Authorization_Codes.create({
            data: {
                code,
                userId,
                clientId,
                redirectUri,
                scope,
                codeChallenge,
                challengeMethod,
                expiresAt,
                used: false,
            },
        });

        return NextResponse.json({ ok: true, code }, { status: 200 });
    } catch (e: any) {
        systemLogger.error("[oauth/generate-code] Error:", e);
        return NextResponse.json(
            { ok: false, error: e?.message || "server_error" },
            { status: 500 }
        );
    }
}
