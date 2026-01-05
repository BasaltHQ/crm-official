import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCalendarClientForUser } from "@/lib/gmail";

/**
 * GET /api/calendar/events?start=ISO&end=ISO[&calendarIds=id1,id2,...]
 * Returns scheduled events across the selected calendars within the given time range,
 * including per-event color (from Google colors API or calendar default) and calendar metadata.
 *
 * Response:
 *  200: { ok: true, events: Array<Event>, calendars: Array<{ id, summary, backgroundColor?, foregroundColor? }> }
 *  401: Unauthorized
 *  404: { ok:false, connected:false, error:"Google not connected" }
 *  400/500: error text
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    const calendarIdsParam = url.searchParams.get("calendarIds");

    if (!start || !end) {
      return NextResponse.json({ ok: false, error: "Missing required query params: start, end (ISO-8601)" }, { status: 400 });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid start/end date format" }, { status: 400 });
    }
    if (endDate <= startDate) {
      return NextResponse.json({ ok: false, error: "end must be greater than start" }, { status: 400 });
    }

    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const calendar = await getCalendarClientForUser(userId);
    if (!calendar) {
      return NextResponse.json({ ok: false, connected: false, error: "Google not connected" }, { status: 404 });
    }

    // Determine target calendars
    let targetIds: string[] = [];
    if (calendarIdsParam && calendarIdsParam.trim().length > 0) {
      targetIds = calendarIdsParam.split(",").map((id) => id.trim()).filter((x) => !!x);
    }
    if (targetIds.length === 0) {
      // Default to primary + any owned calendars (optional: primary only)
      targetIds = ["primary"];
    }

    // Fetch calendar list to get default colors and summaries
    const calListRes = await calendar.calendarList.list({ maxResults: 250, showHidden: true });
    const calListItems = Array.isArray(calListRes.data.items) ? calListRes.data.items : [];
    const calMeta: Record<string, { id: string; summary: string; backgroundColor?: string; foregroundColor?: string }> = {};
    for (const c of calListItems) {
      if (!c.id) continue;
      calMeta[c.id] = {
        id: c.id,
        summary: c.summary || c.id,
        backgroundColor: c.backgroundColor || undefined,
        foregroundColor: c.foregroundColor || undefined,
      };
    }

    // Fetch Google color maps (events and calendars)
    let colorMapEvents: Record<string, { background: string; foreground: string }> = {};
    try {
      const colors = await calendar.colors.get({});
      const eventColors = colors.data?.event || {};
      for (const key of Object.keys(eventColors || {})) {
        const entry: any = (eventColors as any)[key];
        if (entry?.background) {
          colorMapEvents[key] = {
            background: entry.background,
            foreground: entry.foreground || "#000000",
          };
        }
      }
    } catch {
      // ignore if unavailable
    }

    type ApiEvent = {
      id: string;
      calendarId: string;
      calendarSummary: string;
      summary?: string;
      description?: string;
      startISO: string;
      endISO: string;
      allDay?: boolean;
      location?: string;
      attendees?: Array<{ email?: string; responseStatus?: string }>;
      htmlLink?: string;
      hangoutLink?: string;
      color?: { background: string; foreground: string; source: "event" | "calendar" };
    };

    const events: ApiEvent[] = [];

    // Collect events per calendar
    for (const calId of targetIds) {
      try {
        const list = await calendar.events.list({
          calendarId: calId,
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 2500,
          showDeleted: false,
        });

        const items = Array.isArray(list.data.items) ? list.data.items : [];
        for (const ev of items) {
          const startISO = ev.start?.dateTime || ev.start?.date || undefined;
          const endISO = ev.end?.dateTime || ev.end?.date || undefined;
          if (!startISO || !endISO) continue;

          let eventColor: { background: string; foreground: string; source: "event" | "calendar" } | undefined;

          if (ev.colorId && colorMapEvents[ev.colorId]) {
            eventColor = { background: colorMapEvents[ev.colorId].background, foreground: colorMapEvents[ev.colorId].foreground, source: "event" };
          } else {
            const meta = calMeta[calId];
            if (meta?.backgroundColor) {
              eventColor = { background: meta.backgroundColor, foreground: meta.foregroundColor || "#000000", source: "calendar" };
            }
          }

          events.push({
            id: ev.id || `${calId}:${startISO}`,
            calendarId: calId,
            calendarSummary: calMeta[calId]?.summary || calId,
            summary: ev.summary || undefined,
            description: ev.description || undefined,
            startISO,
            endISO,
            allDay: !!ev.start?.date && !ev.start?.dateTime,
            location: ev.location || undefined,
            attendees: Array.isArray(ev.attendees)
              ? ev.attendees.map((a) => ({
                  email: a.email ?? undefined,
                  responseStatus: a.responseStatus ?? undefined,
                }))
              : undefined,
            htmlLink: ev.htmlLink || undefined,
            hangoutLink:
              ev.hangoutLink ||
              (ev.conferenceData?.entryPoints || []).find((e: any) => e.entryPointType === "video")?.uri ||
              undefined,
            color: eventColor,
          });
        }
      } catch (e: any) {
        // Continue other calendars even if one fails
         
        console.error("[CALENDAR_EVENTS_LIST]", calId, e?.message || e);
      }
    }

    const calendarsResponse = targetIds
      .map((id) => ({
        id,
        summary: calMeta[id]?.summary || id,
        backgroundColor: calMeta[id]?.backgroundColor,
        foregroundColor: calMeta[id]?.foregroundColor,
      }));

    return NextResponse.json({ ok: true, events, calendars: calendarsResponse }, { status: 200 });
  } catch (e: any) {
     
    console.error("[CALENDAR_EVENTS_GET]", e?.message || e);
    return new NextResponse("Failed to fetch events", { status: 500 });
  }
}
