import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmailAuthUrl } from "@/lib/gmail";

export const dynamic = "force-dynamic";

/**
 * GET /api/gmail/connect
 * Returns a Gmail OAuth consent URL for the current user.
 * Frontend should open this URL to start OAuth.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  try {
    const url = getGmailAuthUrl(session.user.id);
    return NextResponse.json({ url }, { status: 200 });
  } catch (error) {
     
    console.error("[GMAIL_CONNECT_GET]", error);
    return new NextResponse("Failed to create Gmail auth URL", { status: 500 });
  }
}
