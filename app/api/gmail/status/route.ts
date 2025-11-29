import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailClientForUser } from "@/lib/gmail";

/**
 * GET /api/gmail/status
 * Checks if Gmail is authenticated and returns the primary email address if available.
 *
 * Response:
 *  200: { ok: true, connected: boolean, emailAddress?: string }
 *  401: Unauthorized
 *  500: Failed to check status
 */
export async function GET(_req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const gmail = await getGmailClientForUser(userId);
    if (!gmail) {
      return NextResponse.json({ ok: true, connected: false }, { status: 200 });
    }

    try {
      const profile = await gmail.users.getProfile({ userId: "me" });
      const emailAddress = profile.data?.emailAddress || undefined;
      return NextResponse.json({ ok: true, connected: true, emailAddress }, { status: 200 });
    } catch {
      // If profile call fails but client exists, treat as connected=false
      return NextResponse.json({ ok: true, connected: false }, { status: 200 });
    }
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[GMAIL_STATUS_GET]", e?.message || e);
    return new NextResponse("Failed to check status", { status: 500 });
  }
}
