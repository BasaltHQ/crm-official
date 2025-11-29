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
 * POST /api/calendar/schedule
 * Creates a calendar event on the authenticated user's Google Calendar. If calendarId is not provided, uses the user's saved default (resource_links.calendarPrefs.defaultId or legacy), otherwise "primary".
 *
 * Body JSON:
 * {
 *   "title": "Discovery Call",
 *   "description": "Intro and scoping",
 *   "start": "2025-11-20T17:00:00Z",  // ISO-8601
 *   "end": "2025-11-20T17:30:00Z",    // ISO-8601
 *   "timeZone": "UTC",                // optional, default "UTC"
 *   "attendees": ["prospect@example.com"], // optional
 *   "location": "Google Meet",        // optional
 *   "leadId": "<crm_Leads._id>"       // optional: updates outreach fields + adds activity
 * }
 *
 * Returns: { ok: true, eventId, htmlLink, hangoutLink, start, end }
 */
export async function POST(req: Request) {
  try {
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
      } catch { }
    }

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const calendar = await getCalendarClientForUser(userId);
    if (!calendar) {
      return NextResponse.json({ ok: false, connected: false, error: "Google not connected" }, { status: 404 });
    }

    const body = await req.json();
    const title = (body?.title || "Meeting") as string;
    const description = (body?.description || "") as string;
    const start = body?.start as string | undefined;
    const end = body?.end as string | undefined;
    let timeZone = typeof body?.timeZone === "string" ? (body.timeZone as string) : undefined;
    const attendees = Array.isArray(body?.attendees) ? (body.attendees as string[]) : [];
    const location = (body?.location as string | undefined) || undefined;
    const leadId = body?.leadId as string | undefined;
    const remindersMinutes: number[] = Array.isArray((body as any)?.reminders) ? ((body as any).reminders as number[]) : [];
    // Note: organizerEmail is NOT accepted from body - it's always derived from the authenticated user's Google Calendar

    // Resolve target calendar: honor explicit body.calendarId, else use user's saved default, else 'primary'
    const requestedCalendarId = typeof body?.calendarId === "string" ? body.calendarId.trim() : undefined;
    let targetCalendarId = requestedCalendarId || undefined;
    // Validate requested calendarId against accessible calendars; if not accessible, unset to trigger default resolution
    try {
      const cl = await calendar.calendarList.list();
      const accessibleIds = new Set(((cl.data.items || []) as any[]).map((i: any) => String(i.id)));
      if (targetCalendarId && !accessibleIds.has(String(targetCalendarId))) {
        targetCalendarId = undefined;
      }
    } catch { }
    if (!targetCalendarId) {
      try {
        const user = await prismadb.users.findFirst({ where: { id: userId } });
        const rl = (user as any)?.resource_links || {};
        const prefs = rl?.calendarPrefs || {};
        const defaultId: string | undefined =
          typeof prefs?.defaultId === "string"
            ? prefs.defaultId
            : ((user as any)?.default_calendar_id as string | undefined);
        targetCalendarId = defaultId || "primary";
      } catch {
        targetCalendarId = "primary";
      }
    }
    // Best-effort: resolve organizer email for response/metadata
    let organizerEmailUsed: string | undefined = targetCalendarId;
    try {
      if (!organizerEmailUsed || organizerEmailUsed === "primary") {
        const cl = await calendar.calendarList.list();
        const primaryItem = (cl.data.items || []).find((i: any) => i.primary);
        organizerEmailUsed =
          typeof primaryItem?.id === "string"
            ? primaryItem.id
            : organizerEmailUsed || ((session as any)?.user?.email as string | undefined);
      }
    } catch { }
    // Derive timeZone from target calendar or primary if not provided
    if (!timeZone) {
      try {
        if (targetCalendarId && targetCalendarId !== "primary") {
          const calMeta = await calendar.calendars.get({ calendarId: targetCalendarId });
          timeZone = String((calMeta.data as any)?.timeZone || "");
        }
        if (!timeZone) {
          const cl2 = await calendar.calendarList.list();
          const primaryItem2 = (cl2.data.items || []).find((i: any) => i.primary);
          timeZone = String((primaryItem2 as any)?.timeZone || "");
        }
      } catch { }
      if (!timeZone) timeZone = "UTC";
    }

    if (!start || !end) {
      return NextResponse.json({ ok: false, error: "Missing required fields: start, end" }, { status: 400 });
    }
    // If input includes an explicit offset (e.g., Z or -07:00), treat it as an absolute instant.
    // Otherwise, interpret as wall-clock in the provided timeZone.
    const hasStartOffset = typeof start === "string" && /([Zz]|[+-]\d{2}:\d{2})$/.test(start);
    const hasEndOffset = typeof end === "string" && /([Zz]|[+-]\d{2}:\d{2})$/.test(end);
    const startZoned = hasStartOffset ? dayjs(start) : dayjs.tz(start as string, timeZone);
    const endZoned = hasEndOffset ? dayjs(end) : dayjs.tz(end as string, timeZone);
    if (!startZoned.isValid() || !endZoned.isValid()) {
      return NextResponse.json({ ok: false, error: "Invalid start/end format" }, { status: 400 });
    }
    if (endZoned.valueOf() <= startZoned.valueOf()) {
      return NextResponse.json({ ok: false, error: "end must be greater than start" }, { status: 400 });
    }
    const startUtcISO = startZoned.utc().toISOString();
    const endUtcISO = endZoned.utc().toISOString();

    const requestBody: any = {
      summary: title,
      description,
      start: { dateTime: startUtcISO, timeZone },
      end: { dateTime: endUtcISO, timeZone },
      attendees: attendees.map((email) => ({ email })),
      location,
      // Optional reminders override
      ...(remindersMinutes.length
        ? {
          reminders: {
            useDefault: false,
            overrides: remindersMinutes.map((m) => ({ method: "popup", minutes: m })),
          },
        }
        : {}),
      // Try to auto-create a Google Meet link if possible
      conferenceData: {
        createRequest: {
          requestId: "ledger1crm-" + Math.random().toString(36).slice(2),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    let insert;
    try {
      insert = await calendar.events.insert({
        calendarId: targetCalendarId,
        requestBody,
        conferenceDataVersion: 1,
        sendUpdates: "all",
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[CALENDAR_EVENTS_INSERT]", (err as any)?.message || err);
      return NextResponse.json(
        { ok: false, error: (err as any)?.message || String(err), calendarIdUsed: targetCalendarId },
        { status: 400 }
      );
    }

    const event = insert.data;
    const eventId = event.id || undefined;
    const htmlLink = event.htmlLink || undefined;
    const hangoutLink =
      event.hangoutLink ||
      (event.conferenceData?.entryPoints || []).find((e: any) => e.entryPointType === "video")?.uri ||
      undefined;

    // If this was for a lead, update outreach fields and insert activity
    // Support both leadId (MongoDB ObjectId) and email address lookup
    if (leadId) {
      try {
        let resolvedLeadId = leadId;

        // If leadId looks like an email, look up the lead by email
        if (leadId.includes("@")) {
          const leadByEmail = await prismadb.crm_Leads.findFirst({
            where: { email: leadId },
          });

          if (!leadByEmail) {
            console.error("[CALENDAR_SCHEDULE_LEAD_LOOKUP] Lead not found by email:", leadId);
            return NextResponse.json(
              {
                ok: false,
                error: "lead_not_found",
                details: `No lead found with email: ${leadId}`,
                eventId,
                htmlLink,
                hangoutLink,
              },
              { status: 400 }
            );
          }

          resolvedLeadId = leadByEmail.id;
        }

        await prismadb.crm_Leads.update({
          where: { id: resolvedLeadId },
          data: {
            outreach_meeting_link: hangoutLink || htmlLink || null,
            outreach_meeting_booked_at: new Date(startUtcISO) as any,
            updatedAt: new Date() as any,
          } as any,
        });

        await prismadb.crm_Lead_Activities.create({
          data: {
            lead: resolvedLeadId,
            user: userId,
            type: "meeting_booked",
            metadata: {
              title,
              description,
              start: startUtcISO,
              end: endUtcISO,
              timeZone,
              attendees,
              location,
              eventId,
              htmlLink,
              hangoutLink,
              organizerEmailUsed,
            } as any,
            createdAt: new Date() as any,
          } as any,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[CALENDAR_SCHEDULE_LEAD_UPDATE]", (e as any)?.message || e);
        // Return the error but still include the event details since the event was created
        return NextResponse.json(
          {
            ok: true,
            eventId,
            htmlLink,
            hangoutLink,
            start: startUtcISO,
            end: endUtcISO,
            attendees,
            calendarIdUsed: targetCalendarId,
            organizerEmailUsed,
            warning: "Event created but lead update failed",
            leadUpdateError: (e as any)?.message || String(e),
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        eventId,
        htmlLink,
        hangoutLink,
        start: startUtcISO,
        end: endUtcISO,
        attendees,
        calendarIdUsed: targetCalendarId,
        organizerEmailUsed,
      },
      { status: 200 }
    );
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("[CALENDAR_SCHEDULE_POST]", e?.message || e);
    return new NextResponse("Failed to schedule event", { status: 500 });
  }
}
