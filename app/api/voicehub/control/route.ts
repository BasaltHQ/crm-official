import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

/**
 * CRM -> VoiceHub control bridge
 *
 * POST /api/voicehub/control
 *  Forward control commands to VoiceHub for the currently registered wallet.
 *
 * Body:
 * {
 *   command: "apply" | "start" | "stop",
 *   payload?: any,              // e.g., { prompt, settings: { voice, vadThreshold, ... } }
 *   correlationId?: string,
 *   walletOverride?: string     // optional override of VoiceHub wallet (lowercased hex)
 * }
 *
 * Behavior:
 *  - Reads systemServices(name='voicehub') to determine serviceId (wallet) and serviceUrl (VoiceHub base origin)
 *  - Falls back to NEXT_PUBLIC_VOICEHUB_BASE_URL or VOICEHUB_BASE_URL if serviceUrl is not set
 *  - Sends POST to {serviceUrl}/api/crm/control with header x-wallet set to wallet
 */

type ControlBody = {
  command?: string;
  payload?: any;
  correlationId?: string;
  walletOverride?: string;
};

function normalizeOrigin(raw?: string | null): string | undefined {
  try {
    const s = (raw || "").trim();
    if (!s) return undefined;
    const u = new URL(s);
    return u.origin.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as ControlBody;
    const rawCmd = String(body?.command || "").toLowerCase().trim();
    if (!rawCmd || !["apply", "start", "stop"].includes(rawCmd)) {
      return NextResponse.json({ ok: false, error: "invalid_command" }, { status: 400 });
    }

    // Load VoiceHub registration from CRM DB
    const svc = await prismadb.systemServices.findFirst({ where: { name: "voicehub" } });
    const walletDb = (svc?.serviceId || "").trim().toLowerCase();
    const urlDb = normalizeOrigin(svc?.serviceUrl || null);

    // Allow override via body
    const walletOverride = String(body?.walletOverride || "").trim().toLowerCase();
    const wallet = (walletOverride || walletDb).toLowerCase();

    // Derive VoiceHub base from DB or env fallback
    const envRaw =
      (process.env.NEXT_PUBLIC_VOICEHUB_BASE_URL || process.env.VOICEHUB_BASE_URL || "").trim();
    const urlEnv = normalizeOrigin(envRaw);
    const voicehubBase = urlDb || urlEnv;
    if (!voicehubBase) {
      return NextResponse.json({ ok: false, error: "voicehub_base_unconfigured" }, { status: 500 });
    }
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "voicehub_wallet_missing" }, { status: 400 });
    }

    // Forward to VoiceHub
    const res = await fetch(`${voicehubBase}/api/crm/control`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-wallet": wallet,
      },
      body: JSON.stringify({
        command: rawCmd,
        payload: body?.payload,
        correlationId: body?.correlationId,
      }),
    });

    // Try parsing JSON; if not JSON, fall back to text
    let out: any = null;
    try {
      out = await res.json();
    } catch {
      try {
        out = await res.text();
      } catch {
        out = null;
      }
    }

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, error: (out && out.error) || out || "voicehub_forward_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        forwarded: { base: voicehubBase, wallet },
        result: out,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unhandled_error" }, { status: 500 });
  }
}
