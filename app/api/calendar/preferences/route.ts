import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";

/**
 * GET /api/calendar/preferences
 * Returns the authenticated user's calendar preferences:
 *   { ok: true, selectedIds: string[], defaultId?: string, colors?: Record<string,{background:string,foreground:string}> }
 *
 * POST /api/calendar/preferences
 * Body JSON:
 *   { selectedIds?: string[], defaultId?: string, colors?: Record<string,{background:string,foreground:string}> }
 * Persists any provided fields and returns the updated preferences.
 */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    let userId = (session as any)?.user?.id as string | undefined;

    // Fallback auth bridge: allow VoiceHub to identify CRM user via x-wallet mapping
    if (!userId) {
      try {
        const wallet = (req.headers.get("x-wallet") || "").trim().toLowerCase();
        if (wallet) {
          const svc = await prismadb.systemServices.findFirst({ where: { name: "voicehub", serviceId: wallet } });
          const mappedUser = (svc?.servicePassword as string | undefined);
          if (mappedUser) {
            userId = mappedUser;
          }
        }
      } catch {}
    }

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prismadb.users.findFirst({ where: { id: userId } });
    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Read preferences from resource_links.calendarPrefs (fallback to legacy fields if present)
    const rl = (user as any)?.resource_links || {};
    const prefs = rl?.calendarPrefs || {};
    let selectedIds: string[] = Array.isArray(prefs?.selectedIds) ? prefs.selectedIds : [];
    let defaultId: string | undefined = typeof prefs?.defaultId === "string" ? prefs.defaultId : undefined;
    let colors: any = prefs?.colors;

    // Backward compatibility: fallback to legacy columns if JSON prefs are empty
    if (selectedIds.length === 0 && Array.isArray((user as any).calendar_selected_ids)) {
      selectedIds = (user as any).calendar_selected_ids as string[];
    }
    if (!defaultId && typeof (user as any).default_calendar_id === "string") {
      defaultId = (user as any).default_calendar_id as string;
    }
    if (!colors && (user as any).calendar_colors) {
      colors = (user as any).calendar_colors;
    }

    return NextResponse.json({ ok: true, selectedIds, defaultId, colors }, { status: 200 });
  } catch (e: any) {
     
    console.error("[CALENDAR_PREFERENCES_GET]", e?.message || e);
    return new NextResponse("Failed to load preferences", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions as any);
    let userId = (session as any)?.user?.id as string | undefined;

    // Fallback auth bridge: allow VoiceHub to identify CRM user via x-wallet mapping
    if (!userId) {
      try {
        const wallet = (req.headers.get("x-wallet") || "").trim().toLowerCase();
        if (wallet) {
          const svc = await prismadb.systemServices.findFirst({ where: { name: "voicehub", serviceId: wallet } });
          const mappedUser = (svc?.servicePassword as string | undefined);
          if (mappedUser) {
            userId = mappedUser;
          }
        }
      } catch {}
    }

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const selectedIds = Array.isArray(body?.selectedIds) ? (body.selectedIds as string[]) : undefined;
    const defaultId = typeof body?.defaultId === "string" ? (body.defaultId as string) : undefined;
    const colors = body?.colors as any | undefined;

    // Persist preferences into resource_links.calendarPrefs (JSON column), preserving existing values
    const user = await prismadb.users.findFirst({ where: { id: userId } });
    const existingPrefs = (user as any)?.resource_links?.calendarPrefs || {};
    const updatedPrefs = {
      selectedIds: selectedIds ?? existingPrefs.selectedIds ?? [],
      defaultId: defaultId ?? existingPrefs.defaultId ?? null,
      colors: colors ?? existingPrefs.colors ?? undefined,
    };
    const updatedResourceLinks = { ...(user as any)?.resource_links, calendarPrefs: updatedPrefs };

    const updated = await prismadb.users.update({
      where: { id: userId },
      data: { resource_links: updatedResourceLinks },
    });

    const outPrefs = (updated as any)?.resource_links?.calendarPrefs || {};
    const outSelected = Array.isArray(outPrefs?.selectedIds) ? outPrefs.selectedIds : [];
    const outDefault = typeof outPrefs?.defaultId === "string" ? outPrefs.defaultId : undefined;
    const outColors = outPrefs?.colors || undefined;

    return NextResponse.json({ ok: true, selectedIds: outSelected, defaultId: outDefault, colors: outColors }, { status: 200 });
  } catch (e: any) {
     
    console.error("[CALENDAR_PREFERENCES_POST]", e?.message || e);
    return new NextResponse("Failed to save preferences", { status: 500 });
  }
}
