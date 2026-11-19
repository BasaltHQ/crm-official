import crypto from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { validateResourceOwnership } from "@/lib/api-utils";

/**
 * GET/POST /api/profile/resources
 * Supports optional ?brandId= query param for per-brand resources.
 * Without brandId: operates on user-level resource_links (backward compatible).
 * With brandId: operates on TeamBrandIdentity resource_links.
 *
 * GET: returns user's or brand's resource_links JSON (or defaults)
 * POST: body { resourceLinks: ResourceLink[] } - saves resource_links
 *
 * ResourceLink shape:
 * { id: string, label: string, href: string, type?: "primary" | "secondary", iconUrl?: string, enabled?: boolean }
 */

const DEFAULT_RESOURCES = [
  { id: "website", label: "Visit Our Website", href: "https://basaltcrm.com", type: "primary", enabled: true, icon: "globe" },
  { id: "calendar", label: "Book a Meeting", href: "https://calendly.com", type: "primary", enabled: true, icon: "calendar" },
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
    const id = String(item.id || "").slice(0, 64) || crypto.randomBytes(8).toString("hex");
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

function parseResourceLinks(raw: any): any[] {
  try {
    if (raw && typeof raw === "object" && Array.isArray(raw) && raw.length) {
      return raw;
    }
  } catch {}
  return DEFAULT_RESOURCES;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");

    if (brandId) {
      const teamInfo = await getCurrentUserTeamId();
      const brand = await prismadb.teamBrandIdentity.findUnique({
        where: { id: brandId },
        select: { team_id: true, resource_links: true },
      });
      if (!brand) {
        return new NextResponse("Brand not found", { status: 404 });
      }
      if (!validateResourceOwnership(teamInfo?.teamId ?? null, brand.team_id, Boolean(teamInfo?.isPlatformAdmin))) {
        return new NextResponse("Forbidden", { status: 403 });
      }
      const resources = parseResourceLinks(brand.resource_links);
      return NextResponse.json({ resources }, { status: 200 });
    }

    // User-level resources (backward compatible)
    const user = await prismadb.users.findUnique({
      where: { id: session.user.id },
      select: { resource_links: true },
    });

    const resources = parseResourceLinks(user?.resource_links);
    return NextResponse.json({ resources }, { status: 200 });
  } catch (error) {
    systemLogger.error("[PROFILE_RESOURCES_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId");

    const payload = await req.json().catch(() => ({}));
    const sanitized = sanitizeResources(payload?.resourceLinks);

    if (brandId) {
      const teamInfo = await getCurrentUserTeamId();
      const brand = await prismadb.teamBrandIdentity.findUnique({
        where: { id: brandId },
        select: { id: true, team_id: true },
      });
      if (!brand) {
        return new NextResponse("Brand not found", { status: 404 });
      }
      if (!validateResourceOwnership(teamInfo?.teamId ?? null, brand.team_id, Boolean(teamInfo?.isPlatformAdmin))) {
        return new NextResponse("Forbidden", { status: 403 });
      }

      // Brand-level save
      await prismadb.teamBrandIdentity.update({
        where: { id: brandId },
        data: {
          resource_links: sanitized as any,
        },
      });
      return NextResponse.json({ status: "ok", resources: sanitized }, { status: 200 });
    }

    // User-level save (backward compatible)
    await prismadb.users.update({
      where: { id: session.user.id },
      data: {
        resource_links: sanitized as any,
      },
    });

    return NextResponse.json({ status: "ok", resources: sanitized }, { status: 200 });
  } catch (error) {

    systemLogger.error("[PROFILE_RESOURCES_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
