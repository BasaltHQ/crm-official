import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/gmail";
import { systemLogger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/callback?code=...&state=...
 * Handles Gmail OAuth callback, stores tokens, and redirects the user.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      return new NextResponse("Missing code", { status: 400 });
    }

    if (!state) {
      return new NextResponse("Forbidden: Missing OAuth state", { status: 403 });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
    } catch {
      try {
        parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
      } catch {
        return new NextResponse("Forbidden: Invalid OAuth state", { status: 403 });
      }
    }

    if (!parsed || typeof parsed.u !== "string" || parsed.u !== session.user.id) {
      return new NextResponse("Forbidden: OAuth state user mismatch", { status: 403 });
    }

    await exchangeCodeForTokens(session.user.id, code);

    // Redirect to Profile or Sales Dashboard; default to Profile page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "/";
    const redirectTo = new URL("/profile", appUrl).toString();
    return NextResponse.redirect(redirectTo, { status: 302 });
  } catch (error) {
     
    systemLogger.error("[GMAIL_CALLBACK_GET]", error);
    return new NextResponse("Failed to handle Gmail callback", { status: 500 });
  }
}
