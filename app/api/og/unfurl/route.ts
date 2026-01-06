import { NextResponse } from "next/server";

function pick<T extends string>(html: string, prop: T, attr: "property" | "name" = "property") {
  const re = new RegExp(`<meta[^>]+${attr}=["']${prop}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const m = html.match(re);
  return m?.[1];
}

function absolutize(url: string, base: string) {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const url = searchParams.get("url");
    if (!url) return new NextResponse("Missing url", { status: 400 });

    const res = await fetch(url, { headers: { "User-Agent": "BasaltCRM-Link-Preview/1.0" } });
    if (!res.ok) return new NextResponse(`Fetch failed: ${res.status}`, { status: 502 });
    const html = await res.text();

    const title = pick(html, "og:title") || pick(html, "twitter:title") || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || undefined;
    const description = pick(html, "og:description") || pick(html, "twitter:description") || html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] || undefined;
    const imageRaw = pick(html, "og:image") || pick(html, "twitter:image") || undefined;
    const image = imageRaw ? absolutize(imageRaw, url) : undefined;
    let siteName = pick(html, "og:site_name") || undefined;
    try { if (!siteName) siteName = new URL(url).hostname; } catch { }

    return NextResponse.json({ url, title, description, image, siteName }, { status: 200, headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (e: any) {
    return new NextResponse(e?.message || "Unfurl error", { status: 500 });
  }
}
