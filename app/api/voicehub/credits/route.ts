import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";

/**
 * CRM -> VoiceHub credit check bridge
 *
 * GET/POST /api/voicehub/credits
 *  Performs a silent credit/balance check against VoiceHub for the registered wallet.
 *
 * Body (POST) or Query (GET):
 * {
 *   walletOverride?: string   // optional override of VoiceHub wallet (lowercased hex)
 * }
 *
 * Behavior:
 *  - Reads systemServices(name='voicehub') to determine serviceId (wallet) and serviceUrl (VoiceHub base origin)
 *  - Falls back to NEXT_PUBLIC_VOICEHUB_BASE_URL or VOICEHUB_BASE_URL if serviceUrl is not set
 *  - Sends GET to {serviceUrl}/api/billing/balance with header x-wallet set to wallet
 *  - Returns the VoiceHub balance payload, e.g. { balanceSeconds, purchasedSeconds, usedSeconds, unlimited?, plan?, planExpiry? }
 */

type CreditBody = {
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

async function resolveVoiceHub(): Promise<{ base?: string; wallet?: string }> {
  try {
    const svc = await prismadb.systemServices.findFirst({ where: { name: "voicehub" } });
    const walletDb = (svc?.serviceId || "").trim().toLowerCase();
    const urlDb = normalizeOrigin(svc?.serviceUrl || null);
    const envRaw = (process.env.NEXT_PUBLIC_VOICEHUB_BASE_URL || process.env.VOICEHUB_BASE_URL || "").trim();
    const urlEnv = normalizeOrigin(envRaw);
    return { base: urlDb || urlEnv, wallet: walletDb };
  } catch {
    const envRaw = (process.env.NEXT_PUBLIC_VOICEHUB_BASE_URL || process.env.VOICEHUB_BASE_URL || "").trim();
    const urlEnv = normalizeOrigin(envRaw);
    return { base: urlEnv, wallet: undefined };
  }
}

async function checkBalance(voicehubBase: string, wallet: string) {
  const res = await fetch(`${voicehubBase}/api/billing/balance`, {
    method: "GET",
    headers: {
      "x-wallet": wallet,
    },
  });

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

  return { ok: res.ok, status: res.status, result: out };
}

export async function GET(req: NextRequest) {
  try {
    const { base, wallet: walletDb } = await resolveVoiceHub();
    if (!base) {
      return NextResponse.json({ ok: false, error: "voicehub_base_unconfigured" }, { status: 500 });
    }

    // Allow override via query
    const url = new URL(req.url);
    const walletOverride = String(url.searchParams.get("wo") || "").trim().toLowerCase();
    const wallet = (walletOverride || walletDb || "").toLowerCase();
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "voicehub_wallet_missing" }, { status: 400 });
    }

    const { ok, status, result } = await checkBalance(base, wallet);
    if (!ok) {
      return NextResponse.json(
        { ok: false, status, error: (result && result.error) || result || "voicehub_balance_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, forwarded: { base, wallet }, balance: result },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unhandled_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as CreditBody;
    const { base, wallet: walletDb } = await resolveVoiceHub();
    if (!base) {
      return NextResponse.json({ ok: false, error: "voicehub_base_unconfigured" }, { status: 500 });
    }

    // Allow override via body
    const walletOverride = String(body?.walletOverride || "").trim().toLowerCase();
    const wallet = (walletOverride || walletDb || "").toLowerCase();
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "voicehub_wallet_missing" }, { status: 400 });
    }

    const { ok, status, result } = await checkBalance(base, wallet);
    if (!ok) {
      return NextResponse.json(
        { ok: false, status, error: (result && result.error) || result || "voicehub_balance_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, forwarded: { base, wallet }, balance: result },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unhandled_error" }, { status: 500 });
  }
}
