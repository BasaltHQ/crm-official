import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const responseType = url.searchParams.get("response_type");
    const clientId = url.searchParams.get("client_id");
    const redirectUri = url.searchParams.get("redirect_uri");
    const scope = url.searchParams.get("scope") || "softphone:control outreach:write leads:read";
    const state = url.searchParams.get("state") || "";
    const codeChallenge = url.searchParams.get("code_challenge");
    const codeChallengeMethod = url.searchParams.get("code_challenge_method") || "S256";
    const modeJson = url.searchParams.get("json") === "1";

    if (responseType !== "code") {
      return NextResponse.json({ ok: false, error: "invalid_response_type" }, { status: 400 });
    }
    if (!clientId) {
      return NextResponse.json({ ok: false, error: "missing_client_id" }, { status: 400 });
    }
    if (!redirectUri) {
      return NextResponse.json({ ok: false, error: "missing_redirect_uri" }, { status: 400 });
    }
    if (!(await isAllowedRedirectUri(redirectUri))) {
      return NextResponse.json({ ok: false, error: "invalid_redirect_uri" }, { status: 400 });
    }
    if (!codeChallenge || codeChallengeMethod !== "S256") {
      return NextResponse.json({ ok: false, error: "invalid_pkce" }, { status: 400 });
    }

    // If caller explicitly wants JSON, preserve scaffold JSON behavior.
    if (modeJson) {
      const mockCode = `mock_code_${crypto.randomBytes(32).toString("hex")}`;
      const suggestedRedirect = `${redirectUri}${redirectUri.includes("?") ? "&" : "?"}code=${encodeURIComponent(mockCode)}${state ? `&state=${encodeURIComponent(state)}` : ""}`;
      return NextResponse.json(
        {
          ok: true,
          clientId,
          scope,
          state,
          codeChallengeMethod,
          authorize_url: url.toString(),
          suggested_redirect: suggestedRedirect,
          note: "Scaffold JSON: add json=1 to keep this behavior; default flow redirects to branded UI.",
        },
        { status: 200 }
      );
    }

    // Default: redirect to branded consent UI (valid URL path) preserving all query params (locale default: en)
    const origin = url.origin;
    const ui = new URL(`${origin}/oauth/authorize`);
    ui.searchParams.set("response_type", responseType!);
    ui.searchParams.set("client_id", clientId!);
    ui.searchParams.set("redirect_uri", redirectUri!);
    ui.searchParams.set("scope", scope);
    if (state) ui.searchParams.set("state", state);
    ui.searchParams.set("code_challenge", codeChallenge!);
    ui.searchParams.set("code_challenge_method", codeChallengeMethod);
    ui.searchParams.set("popup", "1");
    return NextResponse.redirect(ui.toString(), { status: 302 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}
