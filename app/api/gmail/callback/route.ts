import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { exchangeCodeForTokens } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/callback?code=...&state=...
 * Handles Gmail OAuth callback, stores tokens, and redirects the user.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code) {
      return new NextResponse("Missing code", { status: 400 });
    }

    // Decode state, prefer server session userId if mismatch
    let userId = session.user.id;
    if (state) {
      try {
        const parsed = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        if (parsed?.u && typeof parsed.u === "string") userId = parsed.u;
      } catch {
        // ignore invalid state
      }
    }

    await exchangeCodeForTokens(userId, code);

    // Redirect to Profile or Sales Dashboard; default to Profile page
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "/";
    const redirectTo = new URL("/profile", appUrl).toString();
    return NextResponse.redirect(redirectTo, { status: 302 });
  } catch (error) {
     
    console.error("[GMAIL_CALLBACK_GET]", error);
    return new NextResponse("Failed to handle Gmail callback", { status: 500 });
  }
}
