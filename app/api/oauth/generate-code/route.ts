import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

/**
 * POST /api/oauth/generate-code
 * Generate an authorization code server-side with authenticated user context.
 * 
 * Expected body:
 * {
 *   clientId: string,
 *   redirectUri: string,
 *   scope?: string,
 *   codeChallenge: string,
 *   challengeMethod?: string
 * }
 * 
 * Returns:
 * {
 *   ok: boolean,
 *   code?: string,
 *   error?: string
 * }
 */
export async function POST(req: NextRequest) {
    try {
        // Get authenticated user
        const session = await getServerSession(authOptions as any);
        const userId = (session as any)?.user?.id as string | undefined;

        if (!userId) {
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
        if (!codeChallenge) {
            return NextResponse.json({ ok: false, error: "missing_code_challenge" }, { status: 400 });
        }

        // Generate a cryptographically secure authorization code
        const code = `auth_${Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")}`;

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
        console.error("[oauth/generate-code] Error:", e);
        return NextResponse.json(
            { ok: false, error: e?.message || "server_error" },
            { status: 500 }
        );
    }
}
