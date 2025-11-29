import { NextResponse } from "next/server";

// Ensure Node.js runtime for AWS SDK compatibility
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = 'auto';
import { ChimeSDKMeetingsClient, CreateMeetingCommand, CreateAttendeeCommand } from "@aws-sdk/client-chime-sdk-meetings";

const REGION = process.env.CHIME_REGION || process.env.AWS_REGION || "us-west-2";
const MEETING_REGION = process.env.CHIME_APP_MEETING_REGION || REGION;

export async function POST() {
  try {
    const client = new ChimeSDKMeetingsClient({ region: REGION });
    const meetingRes = await client.send(new CreateMeetingCommand({
      ClientRequestToken: `${Date.now()}_${Math.floor(Math.random()*1e9)}`,
      MediaRegion: MEETING_REGION,
      ExternalMeetingId: `web-${Date.now()}`,
    }));
    const meeting = meetingRes.Meeting;
    if (!meeting?.MeetingId) return new NextResponse("Failed to create meeting", { status: 500 });

    const attendeeRes = await client.send(new CreateAttendeeCommand({
      MeetingId: meeting.MeetingId,
      ExternalUserId: `user-${Math.floor(Math.random() * 1e9)}`,
    }));

    const meetingArn = (meeting as any)?.MeetingArn || null;
    const accountId = meetingArn ? (String(meetingArn).split(":")[4] || null) : null;
    return NextResponse.json({
      meeting,
      attendee: attendeeRes.Attendee,
      meta: { region: REGION, meetingRegion: MEETING_REGION, meetingArn, accountId }
    });
  } catch (e: any) {
    console.error("[CHIME_CREATE_MEETING]", e);
    return new NextResponse(e?.message || "error", { status: 500 });
  }
}
