import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { GMAIL_SCOPES } from "@/lib/gmail";

/**
 * GET /api/google/status
 * Returns whether the current user has Google OAuth tokens stored (i.e., connected).
 * This is used by UI to show "Status: Connected" immediately after auth, without having to call Calendar APIs.
 *
 * Response shape:
 *   200: { ok: true, connected: boolean, provider?: "google", updatedAt?: string }
 *   401: "Unauthorized"
 *   500: "Failed to check status"
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    let userId = (session as any)?.user?.id as string | undefined;

    // Fallback auth bridge: allow VoiceHub to identify CRM user via x-wallet mapping
    if (!userId) {
      try {
        const wallet = (req.headers.get("x-wallet") || "").trim().toLowerCase();
        if (wallet) {
          const svc = await prismadb.systemServices.findFirst({
            where: { name: "voicehub", serviceId: wallet },
          });
          const mappedUser = (svc?.servicePassword as string | undefined);
          if (mappedUser) {
            userId = mappedUser;
          }
        }
      } catch {}
    }

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const token = await prismadb.gmail_Tokens.findFirst({
      where: { user: userId, provider: "google" },
      orderBy: { updatedAt: "desc" },
    });

    if (!token) {
      return NextResponse.json({ ok: true, connected: false }, { status: 200 });
    }

    // Compute scope coverage
    const grantedScopes: string[] =
      typeof (token as any)?.scope === "string" ? (token as any).scope.split(" ") : [];
    const requiredScopes: string[] = GMAIL_SCOPES;
    const missingScopes: string[] = requiredScopes.filter((s) => !grantedScopes.includes(s));
    const hasRequiredScopes = missingScopes.length === 0;

    return NextResponse.json(
      {
        ok: true,
        connected: true,
        provider: "google",
        updatedAt: token.updatedAt ? new Date(token.updatedAt).toISOString() : undefined,
        hasRequiredScopes,
        requiredScopes,
        grantedScopes,
        missingScopes,
      },
      { status: 200 }
    );
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[GOOGLE_STATUS_GET]", e?.message || e);
    return new NextResponse("Failed to check status", { status: 500 });
  }
}
