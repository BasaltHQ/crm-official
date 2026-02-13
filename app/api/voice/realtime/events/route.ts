import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth-guard";

export async function POST(req: Request) {
  // ── Auth guard ──
  const session = await requireApiAuth();
  if (session instanceof Response) return session;

  try {
    // Try to parse JSON, fallback to raw text
    const body =
      (await req
        .json()
        .catch(async () => {
          const text = await req.text();
          try {
            return JSON.parse(text);
          } catch {
            return { raw: text };
          }
        })) || {};

    const time = new Date().toISOString();
    // Server-side logging to surface in terminal
    console.log(`[VOICE_REALTIME_EVENT ${time}]`, body);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[VOICE_REALTIME_EVENT_ERROR]", e?.message || e);
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
