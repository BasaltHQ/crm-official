import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

/**
 * GET/POST /api/profile/resources
 * GET: returns user's resource_links JSON (or defaults)
 * POST: body { resourceLinks: ResourceLink[] } - saves resource_links
 *
 * ResourceLink shape (suggested):
 * { id: string, label: string, href: string, type?: "primary" | "secondary", iconUrl?: string, enabled?: boolean }
 */

const DEFAULT_RESOURCES = [
  { id: "surge", label: "Explore Surge", href: "https://surge.basalthq.com", type: "primary", enabled: true },
  { id: "calendar", label: "Schedule a Call", href: "https://calendar.app.google/EJ4WsqeS2JSXt6ZcA", type: "primary", enabled: true },
  { id: "investor_portal", label: "View Investor Portal", href: "https://stack.angellist.com/s/lp1srl5cnf", type: "secondary", enabled: true },
  { id: "data_room", label: "Access Data Room", href: "https://stack.angellist.com/s/x8g9yjgpbw", type: "secondary", enabled: true },
];

function isSafeUrl(url: string) {
  try {
    const u = new URL(url);
    return ["http:", "https:"].includes(u.protocol);
  } catch {
    return false;
  }
}

function sanitizeResources(input: any): any[] {
  if (!Array.isArray(input)) return DEFAULT_RESOURCES;
  const out: any[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const id = String(item.id || "").slice(0, 64) || Math.random().toString(36).slice(2);
    const label = String(item.label || "").slice(0, 128) || "Link";
    const href = String(item.href || "");
    if (!isSafeUrl(href)) continue;
    const type = item.type === "primary" ? "primary" : item.type === "secondary" ? "secondary" : "secondary";
    const iconUrl = item.iconUrl && isSafeUrl(String(item.iconUrl)) ? String(item.iconUrl) : undefined;
    const enabled = item.enabled === false ? false : true;
    out.push({ id, label, href, type, iconUrl, enabled });
  }
  return out.length ? out : DEFAULT_RESOURCES;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { resource_links: true },
    });

    let resources = DEFAULT_RESOURCES;
    try {
      if (user?.resource_links && typeof user.resource_links === "object") {
        const parsed = user.resource_links as any;
        if (Array.isArray(parsed) && parsed.length) {
          resources = parsed;
        }
      }
    } catch {
      resources = DEFAULT_RESOURCES;
    }

    return NextResponse.json({ resources }, { status: 200 });
  } catch (error) {

    console.error("[PROFILE_RESOURCES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const sanitized = sanitizeResources(payload?.resourceLinks);

    await prismadb.users.update({
      where: { id: session.user.id },
      data: {
        resource_links: sanitized as any,
      },
    });

    return NextResponse.json({ status: "ok", resources: sanitized }, { status: 200 });
  } catch (error) {

    console.error("[PROFILE_RESOURCES_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
