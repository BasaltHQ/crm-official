import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";

// GET: Fetch user allocations for a team
export async function GET(req: Request) {
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get("teamId");

    if (!teamId) {
        return NextResponse.json({ error: "teamId required" }, { status: 400 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const members = await prismadb.users.findMany({
        where: { team_id: teamId },
        select: {
            id: true,
            name: true,
            email: true,
            usage_allocations: {
                where: { team_id: teamId },
                select: {
                    id: true,
                    emails_per_month: true,
                    sms_per_month: true,
                    voice_minutes_per_month: true,
                },
                take: 1,
            },
        },
    });

    const result = members.map((m: any) => {
        const alloc = m.usage_allocations?.[0];
        return {
            id: alloc?.id || "",
            user_id: m.id,
            user_name: m.name || "",
            user_email: m.email || "",
            emails_per_month: alloc?.emails_per_month ?? null,
            sms_per_month: alloc?.sms_per_month ?? null,
            voice_minutes_per_month: alloc?.voice_minutes_per_month ?? null,
        };
    });

    return NextResponse.json(result);
}

// POST: Upsert a user allocation
export async function POST(req: Request) {
    const { error, teamInfo } = await getSessionAndTeam();
    if (error) return error;

    if (!teamInfo!.isAdmin) {
        return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const body = await req.json();
    const { teamId, userId, emails_per_month, sms_per_month, voice_minutes_per_month } = body;

    if (!teamId || !userId) {
        return NextResponse.json({ error: "teamId and userId required" }, { status: 400 });
    }

    if (!validateResourceOwnership(teamInfo!.teamId, teamId, teamInfo!.isPlatformAdmin)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const targetMember = await prismadb.users.findUnique({
        where: { id: userId },
        select: { team_id: true },
    });

    if (!targetMember || targetMember.team_id !== teamId) {
        return NextResponse.json({ error: "User does not belong to this team" }, { status: 400 });
    }

    const existing = await (prismadb as any).teamUserAllocation.findFirst({
        where: { team_id: teamId, user_id: userId },
    });

    if (existing) {
        await (prismadb as any).teamUserAllocation.update({
            where: { id: existing.id },
            data: {
                emails_per_month: emails_per_month ?? null,
                sms_per_month: sms_per_month ?? null,
                voice_minutes_per_month: voice_minutes_per_month ?? null,
            },
        });
    } else {
        await (prismadb as any).teamUserAllocation.create({
            data: {
                team_id: teamId,
                user_id: userId,
                emails_per_month: emails_per_month ?? null,
                sms_per_month: sms_per_month ?? null,
                voice_minutes_per_month: voice_minutes_per_month ?? null,
            },
        });
    }

    return NextResponse.json({ success: true });
}
