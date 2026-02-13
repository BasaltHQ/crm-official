import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth-guard";

/**
 * GET /api/integration/status
 * BasaltCRM integration status endpoint for VoiceHub connection and softphone config.
 *
 * Response:
 * {
 *   voicehub_connected: boolean,
 *   iframeSrc: string,     // e.g., https://basaltcrm.my.connect.aws/ccp-v2/
 *   iframeOrigin: string,  // e.g., https://basaltcrm.my.connect.aws
 *   queueId?: string,
 *   flowId?: string
 * }
 *
 * Notes:
 * - This is a scaffold returning environment-derived softphone config and a placeholder connection flag.
 * - Final implementation should compute voicehub_connected from stored OAuth tokens / connection state.
 * - queueId/flowId can be populated from workspace configuration if applicable.
 */

export async function GET(_req: NextRequest) {
  // ── Auth guard ──
  const session = await requireApiAuth();
  if (session instanceof Response) return session;

  try {
    const base = String(process.env.NEXT_PUBLIC_CONNECT_BASE_URL || "").trim();
    if (!base || !/^https?:\/\//i.test(base)) {
      return NextResponse.json(
        { ok: false, error: "invalid_connect_base_url" },
        { status: 500 }
      );
    }

    // Resolve VoiceHub connection and wallet from CRM persistence (systemServices) and env
    let voicehubConnected = false;
    let voicehubWallet: string | null = null;
    try {
      const svc = await prismadb.systemServices.findFirst({ where: { name: "voicehub" } });
      const configuredBase = String(process.env.VOICEHUB_BASE_URL || process.env.NEXT_PUBLIC_VOICEHUB_BASE_URL || "").trim();
      voicehubConnected = !!(configuredBase || (svc?.serviceUrl && String(svc.serviceUrl).trim()));
      voicehubWallet = svc?.serviceId ? String(svc.serviceId).trim().toLowerCase() : null;
    } catch { }

    const iframeSrc = `${base.replace(/\/+$/, "")}/ccp-v2/`;
    const iframeOrigin = base.replace(/\/+$/, "");

    // Optional queue/flow identifiers from env (or workspace config)
    const queueId = process.env.CONNECT_QUEUE_ID;
    const flowId = process.env.CONNECT_CONTACT_FLOW_ID;

    return NextResponse.json(
      {
        voicehub_connected: voicehubConnected,
        voicehub_wallet: voicehubWallet,
        iframeSrc,
        iframeOrigin,
        ...(queueId ? { queueId } : {}),
        ...(flowId ? { flowId } : {}),
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "failed" },
      { status: 500 }
    );
  }
}
