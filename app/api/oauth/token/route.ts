import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
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
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, any> = {};
    if (contentType.includes("application/json")) {
      body = await req.json().catch(() => ({}));
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text) as any);
    } else {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const grantType = String(body.grant_type || "");
    const code = String(body.code || "");
    const redirectUri = String(body.redirect_uri || "");
    const clientId = String(body.client_id || "");
    const codeVerifier = String(body.code_verifier || "");

    if (grantType !== "authorization_code") {
      return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
    }
    if (!code) {
      return NextResponse.json({ error: "invalid_request", error_description: "missing code" }, { status: 400 });
    }
    if (!redirectUri) {
      return NextResponse.json({ error: "invalid_request", error_description: "missing redirect_uri" }, { status: 400 });
    }
    if (!(await isAllowedRedirectUri(redirectUri))) {
      return NextResponse.json({ error: "invalid_request", error_description: "disallowed redirect_uri" }, { status: 400 });
    }
    if (!clientId) {
      return NextResponse.json({ error: "invalid_request", error_description: "missing client_id" }, { status: 400 });
    }
    if (!codeVerifier) {
      return NextResponse.json({ error: "invalid_request", error_description: "missing code_verifier" }, { status: 400 });
    }

    // Lookup authorization code in database
    const authCode = await prismadb.oauth_Authorization_Codes.findUnique({
      where: { code },
    });

    if (!authCode) {
      return NextResponse.json({ error: "invalid_grant", error_description: "authorization code not found" }, { status: 400 });
    }

    if (authCode.used) {
      return NextResponse.json({ error: "invalid_grant", error_description: "authorization code already used" }, { status: 400 });
    }

    if (authCode.expiresAt < new Date()) {
      return NextResponse.json({ error: "invalid_grant", error_description: "authorization code expired" }, { status: 400 });
    }

    if (authCode.clientId !== clientId) {
      return NextResponse.json({ error: "invalid_grant", error_description: "client_id mismatch" }, { status: 400 });
    }

    if (authCode.redirectUri !== redirectUri) {
      return NextResponse.json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, { status: 400 });
    }

    // Verify PKCE: compute S256(code_verifier) and compare to stored code_challenge
    try {
      const hashBase64 = crypto
        .createHash("sha256")
        .update(codeVerifier, "utf8")
        .digest("base64url");

      if (hashBase64 !== authCode.codeChallenge) {
        return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 400 });
      }
    } catch (e: any) {
      systemLogger.error("[oauth/token] PKCE verification error:", e);
      return NextResponse.json({ error: "server_error", error_description: "PKCE verification failed" }, { status: 500 });
    }

    // Mark code as used
    await prismadb.oauth_Authorization_Codes.update({
      where: { code },
      data: { used: true },
    });

    // Generate cryptographically random tokens
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600;
    const userId = authCode.userId;
    const accessToken = `access_${userId}_${crypto.randomBytes(32).toString("hex")}`;
    const refreshToken = `refresh_${userId}_${crypto.randomBytes(32).toString("hex")}`;

    return NextResponse.json(
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        scope: authCode.scope || "softphone:control outreach:write leads:read",
        issued_at: now,
        user_id: userId,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "server_error", error_description: e?.message || "failed" }, { status: 500 });
  }
}
