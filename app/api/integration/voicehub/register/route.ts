import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * POST /api/integration/voicehub/register
 * Registers VoiceHub connection details inside CRM for UI status indicators.
 *
 * Expects:
 *  - Header: x-wallet (required)
 *  - Body: { serviceUrl?: string }  // optional VoiceHub base/origin
 *
 * Behavior:
 *  - Upserts systemServices entry with name='voicehub'
 *  - Persists serviceId = wallet (lowercased)
 *  - Optionally persists serviceUrl if provided
 */
export async function POST(req: Request) {
  try {
    const wallet = (req.headers.get("x-wallet") || "").trim().toLowerCase();
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "missing_wallet" }, { status: 400 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const rawUrl = typeof body?.serviceUrl === "string" ? body.serviceUrl : "";
    const serviceUrl = rawUrl ? String(rawUrl).trim().replace(/\/+$/, "") : undefined;

    // Resolve current authenticated CRM user (if any)
    const session = await getServerSession(authOptions as any);
    let userId = (session as any)?.user?.id as string | undefined;
    // Fallback: allow VoiceHub to pass the CRM user id explicitly via header/body when session is absent
    try {
      const headerUser = (req.headers.get("x-user-id") || "").trim();
      const bodyUser = typeof body?.userId === "string" ? body.userId.trim() : "";
      if (!userId) {
        userId = headerUser || bodyUser || undefined;
      }
    } catch {}

    const existing = await prismadb.systemServices.findFirst({ where: { name: "voicehub" } });
    if (existing?.id) {
      const data: any = { serviceId: wallet };
      if (serviceUrl) data.serviceUrl = serviceUrl;
      // Persist wallet→CRM user mapping even if session-less (from header/body fallback)
      if (userId) data.servicePassword = userId;
      await prismadb.systemServices.update({ where: { id: existing.id }, data });
    } else {
      const data: any = { name: "voicehub", serviceId: wallet, v: 0 };
      if (serviceUrl) data.serviceUrl = serviceUrl;
      // Persist wallet→CRM user mapping even if session-less (from header/body fallback)
      if (userId) data.servicePassword = userId;
      await prismadb.systemServices.create({ data });
    }

    // Persist wallet mapping on the CRM user record for convenience
    if (userId) {
      try {
        const user = await prismadb.users.findFirst({ where: { id: userId } });
        const rl = (user as any)?.resource_links || {};
        const updatedResourceLinks = { ...rl, voicehubWallet: wallet };
        await prismadb.users.update({
          where: { id: userId },
          data: { resource_links: updatedResourceLinks },
        });
      } catch {}
    }

    return NextResponse.json(
      {
        ok: true,
        persisted: {
          serviceId: wallet,
          ...(serviceUrl ? { serviceUrl } : {}),
          ...(userId ? { userId } : {}),
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unhandled_error" }, { status: 500 });
  }
}
