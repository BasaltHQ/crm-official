import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailAuthUrl, getOAuth2ClientRedirectUri } from "@/lib/gmail";

/**
 * GET /api/google/auth-url
 * Returns a Google OAuth consent URL for the current user to connect Calendar/Gmail.
 * Uses existing OAuth client config from env (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI).
 */
export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const url = getGmailAuthUrl(userId);
    const redirectUri = getOAuth2ClientRedirectUri();
    
    // Log for debugging
    console.log("[GOOGLE_AUTH_URL] Generated OAuth URL with redirect_uri:", redirectUri);
    
    return NextResponse.json({ ok: true, url, redirectUri }, { status: 200 });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[GOOGLE_AUTH_URL_GET]", e?.message || e);
    return new NextResponse("Failed to generate auth URL", { status: 500 });
  }
}
