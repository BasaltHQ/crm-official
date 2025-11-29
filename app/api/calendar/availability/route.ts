import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCalendarClientForUser } from "@/lib/gmail";
import { prismadb } from "@/lib/prisma";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * GET /api/calendar/availability?start=ISO&end=ISO[&timeZone=TZ][&calendarIds=id1,id2,...]
 * Returns merged busy intervals for the authenticated user's calendars between the given range.
 * If calendarIds is not provided, uses the user's saved preferences (selectedIds) if available; otherwise defaults to "primary".
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const timeZone = url.searchParams.get("timeZone") || "UTC";
    const calendarIdsParam = url.searchParams.get("calendarIds");

    if (!start || !end) {
      return NextResponse.json({ ok: false, error: "Missing required query params: start, end (ISO-8601)" }, { status: 400 });
    }

    // Validate ISO date strings respecting provided timeZone.
    // If input includes an explicit offset (e.g., Z or -07:00), treat it as an absolute instant.
    // Otherwise, interpret as wall-clock in the provided timeZone.
    const hasStartOffset = /([Zz]|[+-]\d{2}:\d{2})$/.test(start);
    const hasEndOffset = /([Zz]|[+-]\d{2}:\d{2})$/.test(end);
    const startZoned = hasStartOffset ? dayjs(start) : dayjs.tz(start, timeZone);
    const endZoned = hasEndOffset ? dayjs(end) : dayjs.tz(end, timeZone);
    if (!startZoned.isValid() || !endZoned.isValid()) {
      return NextResponse.json({ ok: false, error: "Invalid start/end date format" }, { status: 400 });
    }
    if (endZoned.valueOf() <= startZoned.valueOf()) {
      return NextResponse.json({ ok: false, error: "end must be greater than start" }, { status: 400 });
    }
    const startUtcISO = startZoned.utc().toISOString();
    const endUtcISO = endZoned.utc().toISOString();

    const session = await getServerSession(authOptions as any);
    let userId = (session as any)?.user?.id as string | undefined;

    // Fallback auth bridge: allow VoiceHub to identify CRM user via x-wallet mapping (DB-backed)
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

    const calendar = await getCalendarClientForUser(userId);
    if (!calendar) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          error: "Google not connected",
          hint: "Connect Google in CRM or via /api/google/auth-url and retry. Preferences will be honored once connected.",
        },
        { status: 404 }
      );
    }

    let items: { id: string }[] = [];
    if (calendarIdsParam && calendarIdsParam.trim().length > 0) {
      items = calendarIdsParam
        .split(",")
        .map((id) => ({ id: id.trim() }))
        .filter((x) => !!x.id);
    } else {
      // Use user preferences when no explicit calendarIds are provided
      const user = await prismadb.users.findFirst({ where: { id: userId } });
      // Prefer JSON-based prefs in resource_links.calendarPrefs, fallback to legacy columns
      const rl = (user as any)?.resource_links || {};
      const prefs = rl?.calendarPrefs || {};
      const selectedIds: string[] = Array.isArray(prefs?.selectedIds)
        ? prefs.selectedIds
        : (Array.isArray((user as any)?.calendar_selected_ids)
            ? ((user as any).calendar_selected_ids as string[])
            : []);
      const defaultId: string | undefined =
        typeof prefs?.defaultId === "string"
          ? prefs.defaultId
          : ((user as any)?.default_calendar_id as string | undefined);
      // Build candidate ids from preferences, validate against user's accessible calendars
      const candidateIds = (selectedIds.length ? [...selectedIds] : ["primary"]);
      if (defaultId && !candidateIds.includes(defaultId)) {
        candidateIds.push(defaultId);
      }
      try {
        const cl = await calendar.calendarList.list();
        const accessibleIds = new Set(((cl.data.items || []) as any[]).map((i: any) => String(i.id)));
        const validIds = candidateIds.filter((id) => accessibleIds.has(String(id)));
        const idsToUse = validIds.length ? validIds : ["primary"];
        items = idsToUse.map((id) => ({ id }));
      } catch {
        // If listing fails, fall back to candidateIds
        items = candidateIds.map((id) => ({ id }));
      }
    }

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: startUtcISO,
        timeMax: endUtcISO,
        timeZone,
        items,
      },
    });

    // Collect and merge busy intervals across all selected calendars
    type Interval = { start: string; end: string };
    const intervals: Interval[] = [];
    const calMap: Record<string, any> = (res.data?.calendars ?? {}) as any;
    for (const key of Object.keys(calMap)) {
      const arr: Interval[] = Array.isArray(calMap[key]?.busy) ? calMap[key].busy : [];
      for (const b of arr) {
        if (b?.start && b?.end) {
          intervals.push({ start: b.start, end: b.end });
        }
      }
    }

    // Merge overlapping intervals
    const toMillis = (iso: string) => new Date(iso).getTime();
    intervals.sort((a, b) => toMillis(a.start) - toMillis(b.start));
    const merged: Interval[] = [];
    for (const cur of intervals) {
      if (merged.length === 0) {
        merged.push({ ...cur });
        continue;
      }
      const last = merged[merged.length - 1];
      if (toMillis(cur.start) <= toMillis(last.end)) {
        // overlap -> extend end
        if (toMillis(cur.end) > toMillis(last.end)) {
          last.end = cur.end;
        }
      } else {
        merged.push({ ...cur });
      }
    }

    // Fallback: if freebusy returned no busy intervals, derive busy from events.list across selected calendars
    let fallbackUsed = false;
    if (merged.length === 0) {
      try {
        const derived: Interval[] = [];
        for (const it of items) {
          try {
            const evRes = await calendar.events.list({
              calendarId: it.id,
              timeMin: startUtcISO,
              timeMax: endUtcISO,
              singleEvents: true,
              orderBy: "startTime",
              maxResults: 2500,
            });
            const evs = Array.isArray(evRes.data.items) ? evRes.data.items : [];
            for (const ev of evs) {
              // Skip cancelled or explicitly free (transparent) events
              if (ev.status === "cancelled") continue;
              if ((ev as any)?.transparency === "transparent") continue;

              // Extract start/end; handle date-only (all-day) events in the provided timeZone
              let sISO: string | undefined;
              let eISO: string | undefined;
              const s = (ev.start || {}) as any;
              const e = (ev.end || {}) as any;
              if (typeof s.dateTime === "string" && typeof e.dateTime === "string") {
                sISO = dayjs(s.dateTime).utc().toISOString();
                eISO = dayjs(e.dateTime).utc().toISOString();
              } else if (typeof s.date === "string" && typeof e.date === "string") {
                // date is full-day; interpret as wall-clock in timeZone
                const sZ = dayjs.tz(s.date, timeZone).startOf("day").utc().toISOString();
                const eZ = dayjs.tz(e.date, timeZone).startOf("day").utc().toISOString();
                // Google all-day end is exclusive date; ensure end > start
                const endCandidate = dayjs(eZ).valueOf() > dayjs(sZ).valueOf()
                  ? eZ
                  : dayjs.tz(s.date, timeZone).add(1, "day").startOf("day").utc().toISOString();
                sISO = sZ;
                eISO = endCandidate;
              }
              if (sISO && eISO) {
                // Clamp to requested window
                const sMs = Math.max(new Date(sISO).getTime(), new Date(startUtcISO).getTime());
                const eMs = Math.min(new Date(eISO).getTime(), new Date(endUtcISO).getTime());
                if (eMs > sMs) {
                  derived.push({ start: new Date(sMs).toISOString(), end: new Date(eMs).toISOString() });
                }
              }
            }
          } catch {}
        }
        if (derived.length) {
          // Merge derived intervals
          derived.sort((a, b) => toMillis(a.start) - toMillis(b.start));
          const mergedDerived: Interval[] = [];
          for (const cur of derived) {
            if (mergedDerived.length === 0) {
              mergedDerived.push({ ...cur });
              continue;
            }
            const last = mergedDerived[mergedDerived.length - 1];
            if (toMillis(cur.start) <= toMillis(last.end)) {
              if (toMillis(cur.end) > toMillis(last.end)) {
                last.end = cur.end;
              }
            } else {
              mergedDerived.push({ ...cur });
            }
          }
          merged.splice(0, merged.length, ...mergedDerived);
          fallbackUsed = true;
        }
      } catch {}
    }

    // Compute free intervals within [start, end] by subtracting merged busy blocks
    const free: Interval[] = [];
    let cursorMs = new Date(startUtcISO).getTime();
    for (const b of merged) {
      const bStartMs = toMillis(b.start);
      const bEndMs = toMillis(b.end);
      if (cursorMs < bStartMs) {
        free.push({ start: new Date(cursorMs).toISOString(), end: new Date(bStartMs).toISOString() });
      }
      cursorMs = Math.max(cursorMs, bEndMs);
    }
    if (cursorMs < new Date(endUtcISO).getTime()) {
      free.push({ start: new Date(cursorMs).toISOString(), end: endUtcISO });
    }

    // Optional: persist availability snapshot alongside preferences for rapid tool calls
    try {
      const persist = (url.searchParams.get("persist") || "").toLowerCase() === "true";
      if (persist) {
        const user = await prismadb.users.findFirst({ where: { id: userId } });
        const rl = (user as any)?.resource_links || {};
        const updatedRL = {
          ...rl,
          calendarAvailabilityCache: {
            start: startUtcISO,
            end: endUtcISO,
            timeZone,
            busy: merged,
            free,
            calendarsQueried: items.map((i) => i.id),
            updatedAt: new Date().toISOString(),
          },
        };
        await prismadb.users.update({
          where: { id: userId },
          data: { resource_links: updatedRL },
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[CALENDAR_AVAILABILITY_CACHE_PERSIST]", (e as any)?.message || e);
    }

    return NextResponse.json(
      {
        ok: true,
        timeZone,
        busy: merged,
        free,
        calendarsQueried: items.map((i) => i.id),
        details: fallbackUsed ? { fallback: "events.list" } : undefined,
      },
      { status: 200 }
    );
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[CALENDAR_AVAILABILITY_GET]", e?.message || e);
    return new NextResponse("Failed to fetch availability", { status: 500 });
  }
}
