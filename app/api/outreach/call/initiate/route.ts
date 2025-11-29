import { NextResponse } from "next/server";

// Ensure Node.js runtime for AWS SDK/Prisma compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { startOutboundCall } from "@/lib/aws/connect";
import { createSipMediaApplicationCall } from "@/lib/aws/chime-voice";
import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } from "@aws-sdk/client-chime-sdk-meetings";

// Minimal global for agent bot join info across branches in this request scope
// (kept function-local via closure variable below)

/**
 * POST /api/outreach/call/initiate
 * Body: { leadId: string; phone?: string; attributes?: Record<string,string> }
 */

type Body = { leadId: string; phone?: string; attributes?: Record<string,string>; meeting?: { meetingId: string; attendeeId: string; joinToken: string } };

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });

    const body = (await req.json()) as Body;
    const phoneInput = (body?.phone || "").trim();
    let agentJoin: { meeting: any; attendee: any } | undefined;

    // Auto-create a Chime meeting/attendee when not provided so callers don't need manual setup per call
    if (!body.meeting) {
      try {
        const REGION = process.env.CHIME_REGION || process.env.AWS_REGION || "us-west-2";
        const MEETING_REGION = process.env.CHIME_APP_MEETING_REGION || REGION;
        const meetingsClient = new ChimeSDKMeetingsClient({ region: REGION });
        const meetingRes = await meetingsClient.send(new CreateMeetingCommand({
          ClientRequestToken: `${Date.now()}_${Math.floor(Math.random()*1e9)}`,
          MediaRegion: MEETING_REGION,
          ExternalMeetingId: `web-${Date.now()}`,
        }));
        const meetingId = meetingRes?.Meeting?.MeetingId;
        const meetingObj = (meetingRes as any)?.Meeting;
        if (meetingId) {
          const attendeeRes = await meetingsClient.send(new CreateAttendeeCommand({
            MeetingId: meetingId,
            ExternalUserId: `azure-agent-${Math.floor(Math.random() * 1e9)}`,
          }));
          const attendeeId = attendeeRes?.Attendee?.AttendeeId;
          const joinToken = attendeeRes?.Attendee?.JoinToken;
          if (attendeeId && joinToken) {
            body.meeting = { meetingId, attendeeId, joinToken };
            agentJoin = { meeting: meetingObj, attendee: attendeeRes?.Attendee };
            const meetingArn = meetingObj?.MeetingArn || null;
            const accountId = meetingArn ? (String(meetingArn).split(":")[4] || null) : null;
            (body as any).meta = { meetingArn, accountId, region: REGION, meetingRegion: MEETING_REGION } as any;
          }
        }
      } catch (e) {
        console.warn("[CALL_INITIATE][MEETING_CREATE_WARN]", (e as any)?.message || e);
      }
    }

    // Ensure a dedicated attendee for the PSTN leg (do not reuse the web/browser attendee)
    try {
      if (body?.meeting?.meetingId) {
        const REGION = process.env.CHIME_REGION || process.env.AWS_REGION || "us-west-2";
        const meetingsClient = new ChimeSDKMeetingsClient({ region: REGION });
        const attRes = await meetingsClient.send(new CreateAttendeeCommand({
          MeetingId: body.meeting.meetingId,
          ExternalUserId: `pstn-leg-${Math.floor(Math.random() * 1e9)}`,
        }));
        const attendeeId = attRes?.Attendee?.AttendeeId;
        const joinToken = attRes?.Attendee?.JoinToken;
        if (attendeeId && joinToken) {
          // Overwrite body.meeting with PSTN attendee for SIP headers
          body.meeting = { meetingId: body.meeting.meetingId, attendeeId, joinToken };
        }
      }
    } catch (e) {
      console.warn("[CALL_INITIATE][ATTENDEE_CREATE_WARN]", (e as any)?.message || e);
    }

    // Start server-side AgentBot (non-blocking) if gateway URL and agentJoin are available
    try {
      const gw = (process.env.AZURE_GATEWAY_URL || '').trim();
      if (gw && agentJoin?.meeting && agentJoin?.attendee) {
        const url = `${gw.replace(/\/$/, '')}/start-bot`;
        // Fire-and-forget; do not block the call flow
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ join: agentJoin }),
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('[CALL_INITIATE][START_BOT_WARN]', (e as any)?.message || e);
    }

    // Resolve lead either by provided leadId or by phone when present
    let lead = body?.leadId
      ? await prismadb.crm_Leads.findUnique({
          where: { id: body.leadId },
          select: { id: true, phone: true, firstName: true, lastName: true, company: true },
        })
      : (phoneInput
          ? await prismadb.crm_Leads.findFirst({
              where: { phone: phoneInput },
              select: { id: true, phone: true, firstName: true, lastName: true, company: true },
            })
          : null);

    if (!lead) {
      // If neither a valid leadId nor a matching phone was provided, require one of them
      if (!body?.leadId && !phoneInput) {
        return new NextResponse("leadId or phone required", { status: 400 });
      }
      // No lead matched; if phone provided, create a placeholder lead so we can proceed
      if (phoneInput) {
        lead = await prismadb.crm_Leads.create({
          data: {
            phone: phoneInput,
            firstName: (body?.attributes as any)?.firstName || "Unknown",
            lastName: (body?.attributes as any)?.lastName || "",
            company: (body?.attributes as any)?.leadCompany || "",
          },
          select: { id: true, phone: true, firstName: true, lastName: true, company: true },
        });
      } else {
        // leadId provided but no record found
        return new NextResponse("Lead not found", { status: 404 });
      }
    }

    const dest = (body.phone || lead.phone || "").trim();
    if (!dest) return new NextResponse("No destination phone for lead", { status: 400 });

    const attributesRaw = Object.assign({
      leadId: lead.id,
      leadName: [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead",
      leadCompany: lead.company || "",
      agentUserId: session.user.id,
    }, body.attributes || {},
    // Include meeting join info in Attributes as multiple key variants so SMA can read them regardless of casing/source
    body?.meeting && body.meeting.meetingId && body.meeting.attendeeId && body.meeting.joinToken ? {
      "X-Meeting-Id": body.meeting.meetingId,
      "X-Attendee-Id": body.meeting.attendeeId,
      "X-Join-Token": body.meeting.joinToken,
      // Plain keys
      "MeetingId": body.meeting.meetingId,
      "AttendeeId": body.meeting.attendeeId,
      "JoinToken": body.meeting.joinToken,
      // Uppercase variants
      "MEETING_ID": body.meeting.meetingId,
      "ATTENDEE_ID": body.meeting.attendeeId,
      "JOIN_TOKEN": body.meeting.joinToken,
    } : {},
    // Include meeting meta and env for diagnostics
    (body as any)?.meta?.meetingArn ? {
      "MeetingArn": (body as any).meta.meetingArn,
      "MEETING_ARN": (body as any).meta.meetingArn,
      "MeetingAccountId": (body as any).meta.accountId || null,
    } : {},
    {
      "MeetingRegionEnv": process.env.CHIME_APP_MEETING_REGION || process.env.CHIME_REGION || process.env.AWS_REGION || "us-west-2",
      "SMARegionEnv": process.env.CHIME_REGION || process.env.AWS_REGION || "us-west-2",
    });

    // Ensure only string values in ArgumentsMap for SMA
    const attributes = Object.fromEntries(
      Object.entries(attributesRaw)
        .filter(([_, v]) => v !== null && v !== undefined)
        .map(([k, v]) => [k, typeof v === 'string' ? v : String(v)])
    ) as Record<string,string>;

    let contactId: string;
    if (process.env.CHIME_SMA_APPLICATION_ID) {
      console.log('[CALL_INITIATE] Using SMA path', {
        dest,
        hasMeeting: !!(body?.meeting && body.meeting.meetingId && body.meeting.joinToken),
        meetingId: body?.meeting?.meetingId,
        attendeeId: body?.meeting?.attendeeId,
      });
      const sipHeaders = body?.meeting && body.meeting.meetingId && body.meeting.attendeeId && body.meeting.joinToken
        ? {
            "x-meeting-id": body.meeting.meetingId,
            "x-attendee-id": body.meeting.attendeeId,
            "x-join-token": body.meeting.joinToken,
          }
        : undefined;
      try {
        const { transactionId } = await createSipMediaApplicationCall({
          destinationPhoneNumber: dest,
          argumentsMap: attributes,
          sipHeaders,
        });
        contactId = transactionId;
        console.log('[CALL_INITIATE] SMA transactionId', contactId);
      } catch (e: any) {
        console.error('[CALL_INITIATE][SMA_ERROR]', e?.message || e);
        return new NextResponse(e?.message || 'SMA call failed', { status: 500 });
      }
    } else {
      console.log('[CALL_INITIATE] Using Connect path', { dest });
      try {
        const { contactId: cid } = await startOutboundCall({ destinationPhoneNumber: dest, attributes });
        contactId = cid;
        console.log('[CALL_INITIATE] Connect contactId', contactId);
      } catch (e: any) {
        console.error('[CALL_INITIATE][CONNECT_ERROR]', e?.message || e);
        return new NextResponse(e?.message || 'Connect call failed', { status: 500 });
      }
    }

    await prismadb.crm_Leads.update({
      where: { id: lead.id },
      data: {
        call_status: "INITIATED",
        connect_contact_id: contactId,
        pipeline_stage: "Engage_Human" as any,
      },
    });

    await prismadb.crm_Lead_Activities.create({
      data: {
        lead: lead.id,
        user: session.user.id,
        type: "call_initiated",
        metadata: { contactId, to: dest, attributes, pipeline_stage: "Engage_Human" } as any,
      },
    });

    const payload: any = { contactId, to: dest };
    if (agentJoin?.meeting && agentJoin?.attendee) {
      payload.meeting = agentJoin.meeting;
      payload.attendee = agentJoin.attendee;
      try { payload.meta = (body as any)?.meta || null; } catch {}
    }
    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    console.error("[CALL_INITIATE]", error?.message || error);
    return new NextResponse(error?.message || "Internal Error", { status: 500 });
  }
}
