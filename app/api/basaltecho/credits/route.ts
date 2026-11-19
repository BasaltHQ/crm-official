import { NextRequest, NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam } from "@/lib/api-utils";

/**
 * CRM -> BasaltECHO credit check bridge
 *
 * GET/POST /api/basaltecho/credits
 *  Performs a silent credit/balance check against BasaltECHO for the registered wallet.
 *
 * Body (POST) or Query (GET):
 * {
 *   walletOverride?: string   // optional override of BasaltECHO wallet (lowercased hex)
 * }
 *
 * Behavior:
 *  - Reads systemServices(name='basaltecho') to determine serviceId (wallet) and serviceUrl (BasaltECHO base origin)
 *  - Falls back to NEXT_PUBLIC_BASALTECHO_BASE_URL or BASALTECHO_BASE_URL if serviceUrl is not set
 *  - Sends GET to {serviceUrl}/api/billing/balance with header x-wallet set to wallet
 *  - Returns the BasaltECHO balance payload, e.g. { balanceSeconds, purchasedSeconds, usedSeconds, unlimited?, plan?, planExpiry? }
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

async function resolveBasaltECHO(): Promise<{ base?: string; wallet?: string }> {
  try {
    const svc = await prismadb.systemServices.findFirst({ where: { name: "basaltecho" } });
    const walletDb = (svc?.serviceId || "").trim().toLowerCase();
    const urlDb = normalizeOrigin(svc?.serviceUrl || null);
    const envRaw = (process.env.NEXT_PUBLIC_BASALTECHO_BASE_URL || process.env.BASALTECHO_BASE_URL || "").trim();
    const urlEnv = normalizeOrigin(envRaw);
    return { base: urlDb || urlEnv, wallet: walletDb };
  } catch {
    const envRaw = (process.env.NEXT_PUBLIC_BASALTECHO_BASE_URL || process.env.BASALTECHO_BASE_URL || "").trim();
    const urlEnv = normalizeOrigin(envRaw);
    return { base: urlEnv, wallet: undefined };
  }
}

async function checkBalance(basaltechoBase: string, wallet: string) {
  const res = await fetch(`${basaltechoBase}/api/billing/balance`, {
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
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  try {
    const { base, wallet: walletDb } = await resolveBasaltECHO();
    if (!base) {
      return NextResponse.json({ ok: false, error: "basaltecho_base_unconfigured" }, { status: 500 });
    }

    const url = new URL(req.url);
    const walletOverride = String(url.searchParams.get("wo") || "").trim().toLowerCase();
    if (walletOverride && !teamInfo?.isPlatformAdmin) {
      return NextResponse.json({ ok: false, error: "Forbidden — walletOverride requires platform admin" }, { status: 403 });
    }

    const wallet = (walletOverride || walletDb || "").toLowerCase();
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "basaltecho_wallet_missing" }, { status: 400 });
    }

    const { ok, status, result } = await checkBalance(base, wallet);
    if (!ok) {
      return NextResponse.json(
        { ok: false, status, error: (result && result.error) || result || "basaltecho_balance_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, balance: result },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unhandled_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  try {
    const body = (await req.json().catch(() => ({}))) as CreditBody;
    const { base, wallet: walletDb } = await resolveBasaltECHO();
    if (!base) {
      return NextResponse.json({ ok: false, error: "basaltecho_base_unconfigured" }, { status: 500 });
    }

    const walletOverride = String(body?.walletOverride || "").trim().toLowerCase();
    if (walletOverride && !teamInfo?.isPlatformAdmin) {
      return NextResponse.json({ ok: false, error: "Forbidden — walletOverride requires platform admin" }, { status: 403 });
    }

    const wallet = (walletOverride || walletDb || "").toLowerCase();
    if (!wallet) {
      return NextResponse.json({ ok: false, error: "basaltecho_wallet_missing" }, { status: 400 });
    }

    const { ok, status, result } = await checkBalance(base, wallet);
    if (!ok) {
      return NextResponse.json(
        { ok: false, status, error: (result && result.error) || result || "basaltecho_balance_failed" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { ok: true, balance: result },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "unhandled_error" }, { status: 500 });
  }
}
