import { NextResponse } from "next/server";

// Simple fetch diagnostic endpoint to verify client->server requests and headers/cookies
export async function POST(req: Request) {
  try {
    const headers = Object.fromEntries(req.headers.entries());
    // Read body (if any) to ensure the request streams correctly
    const bodyText = await req.text().catch(() => "");
    console.log("[DIAG_FETCH]", {
      time: new Date().toISOString(),
      headers,
      bodyLength: bodyText.length,
      hasCookie: !!headers["cookie"],
      origin: headers["origin"] || null,
      referer: headers["referer"] || null,
    });
    return NextResponse.json({ ok: true, ts: Date.now() }, { status: 200 });
  } catch (e: any) {
    console.error("[DIAG_FETCH][ERROR]", e?.message || e);
    return new NextResponse("Diag fetch error", { status: 500 });
  }
}
