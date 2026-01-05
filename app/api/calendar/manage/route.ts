import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCalendarClientForUser } from "@/lib/gmail";

/**
 * POST /api/calendar/manage
 * Body JSON:
 *   { action: "create" | "delete" | "subscribe" | "unsubscribe" | "updateColor", id?: string, summary?: string, backgroundColor?: string, foregroundColor?: string }
 *
 * Actions:
 *  - create: create a new calendar owned by the user (requires summary)
 *  - delete: delete a calendar (only possible for calendars owned by the user) (requires id)
 *  - subscribe: add an existing calendar to the user's calendarList by id (requires id)
 *  - unsubscribe: remove a calendar from the user's calendarList (requires id)
 *  - updateColor: updates a calendarList entry's color (requires id and background/foreground)
 *
 * Returns:
 *   200: { ok: true, result?: any }
 *   401: Unauthorized
 *   404: { ok:false, connected:false, error:"Google not connected" }
 *   400/500: error text
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const session = await getServerSession(authOptions as any);
    const userId = (session as any)?.user?.id as string | undefined;
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const calendar = await getCalendarClientForUser(userId);
    if (!calendar) {
      return NextResponse.json({ ok: false, connected: false, error: "Google not connected" }, { status: 404 });
    }

    const body = await req.json();
    const action = body?.action as string | undefined;

    if (!action) {
      return NextResponse.json({ ok: false, error: "Missing action" }, { status: 400 });
    }

    switch (action) {
      case "create": {
        const summary = body?.summary as string | undefined;
        if (!summary) {
          return NextResponse.json({ ok: false, error: "Missing summary for create" }, { status: 400 });
        }
        const res = await calendar.calendars.insert({ requestBody: { summary } });
        return NextResponse.json({ ok: true, result: res.data }, { status: 200 });
      }

      case "delete": {
        const id = body?.id as string | undefined;
        if (!id) {
          return NextResponse.json({ ok: false, error: "Missing id for delete" }, { status: 400 });
        }
        await calendar.calendars.delete({ calendarId: id });
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      case "subscribe": {
        const id = body?.id as string | undefined;
        if (!id) {
          return NextResponse.json({ ok: false, error: "Missing id for subscribe" }, { status: 400 });
        }
        // Adds calendar to the user's calendar list
        const res = await calendar.calendarList.insert({ requestBody: { id } });
        return NextResponse.json({ ok: true, result: res.data }, { status: 200 });
      }

      case "unsubscribe": {
        const id = body?.id as string | undefined;
        if (!id) {
          return NextResponse.json({ ok: false, error: "Missing id for unsubscribe" }, { status: 400 });
        }
        await calendar.calendarList.delete({ calendarId: id });
        return NextResponse.json({ ok: true }, { status: 200 });
      }

      case "updateColor": {
        const id = body?.id as string | undefined;
        const backgroundColor = body?.backgroundColor as string | undefined;
        const foregroundColor = body?.foregroundColor as string | undefined;
        if (!id) {
          return NextResponse.json({ ok: false, error: "Missing id for updateColor" }, { status: 400 });
        }
        const patchBody: any = {};
        if (backgroundColor) patchBody.backgroundColor = backgroundColor;
        if (foregroundColor) patchBody.foregroundColor = foregroundColor;

        const res = await calendar.calendarList.patch({ calendarId: id, requestBody: patchBody });
        return NextResponse.json({ ok: true, result: res.data }, { status: 200 });
      }

      default: {
        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
      }
    }
  } catch (e: any) {
     
    console.error("[CALENDAR_MANAGE_POST]", e?.message || e);
    return new NextResponse("Failed to manage calendar", { status: 500 });
  }
}
