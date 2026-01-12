import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

/**
 * POST /oauth/token
 * Scaffold for BasaltCRM OAuth Token endpoint (Authorization Code + PKCE).
 *
 * Expected body (application/json or x-www-form-urlencoded semantics):
 * {
 *   grant_type: "authorization_code",
 *   code: string,
 *   redirect_uri: string,
 *   client_id: string,
 *   code_verifier: string
 * }
 *
 * Behavior (scaffold):
 * - Validates required fields.
 * - Returns mock access/refresh tokens and expiry.
 * - In a full implementation, validate the code against an authorization store,
 *   verify PKCE code_verifier vs previously stored code_challenge, and mint real JWTs.
 *
 * Response (example):
 * {
 *   "access_token": "mock_access_...",
 *   "refresh_token": "mock_refresh_...",
 *   "token_type": "Bearer",
 *   "expires_in": 3600,
 *   "scope": "softphone:control outreach:write leads:read"
 * }
 */

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
      // Best effort parse as JSON, otherwise treat as empty
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
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashBase64 = btoa(String.fromCharCode(...hashArray))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      if (hashBase64 !== authCode.codeChallenge) {
        return NextResponse.json({ error: "invalid_grant", error_description: "PKCE verification failed" }, { status: 400 });
      }
    } catch (e: any) {
      console.error("[oauth/token] PKCE verification error:", e);
      return NextResponse.json({ error: "server_error", error_description: "PKCE verification failed" }, { status: 500 });
    }

    // Mark code as used
    await prismadb.oauth_Authorization_Codes.update({
      where: { code },
      data: { used: true },
    });

    // Generate tokens (still mock for now, but with userId context)
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 3600;
    const userId = authCode.userId;
    const accessToken = `access_${userId}_${Math.random().toString(36).slice(2)}`;
    const refreshToken = `refresh_${userId}_${Math.random().toString(36).slice(2)}`;

    // Auto-detect and persist VoiceHub base URL from redirect_uri so CRM can forward prompts without env config
    try {
      const voicehubOrigin = new URL(redirectUri).origin.replace(/\/+$/, "");
      if (voicehubOrigin && /^https?:\/\//i.test(voicehubOrigin)) {
        const existing = await prismadb.systemServices.findFirst({
          where: { name: "voicehub" },
        });
        if (existing) {
          await prismadb.systemServices.update({
            where: { id: existing.id },
            data: { serviceUrl: voicehubOrigin, servicePassword: userId },
          });
        } else {
          await prismadb.systemServices.create({
            data: { name: "voicehub", serviceUrl: voicehubOrigin, servicePassword: userId, v: 0 },
          });
        }
      }
    } catch { }

    return NextResponse.json(
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "Bearer",
        expires_in: expiresIn,
        scope: authCode.scope || "softphone:control outreach:write leads:read",
        issued_at: now,
        user_id: userId, // Include userId in response for VoiceHub to use
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: "server_error", error_description: e?.message || "failed" }, { status: 500 });
  }
}
