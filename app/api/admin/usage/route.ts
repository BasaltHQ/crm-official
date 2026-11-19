import { NextResponse } from "next/server";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { prismadb } from "@/lib/prisma";
import { resolveSlug, SUBSCRIPTION_PLANS } from "@/config/subscriptions";

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

    const team = await prismadb.team.findUnique({
        where: { id: teamId },
        select: { subscription_plan: true },
    });

    const slug = resolveSlug(team?.subscription_plan);
    const planLimits = SUBSCRIPTION_PLANS[slug].limits;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const quota = await (prismadb as any).teamUsageQuota.findFirst({
        where: {
            team_id: teamId,
            period_start: { gte: monthStart },
        },
        orderBy: { period_start: "desc" },
    });

    const aiLogs = await prismadb.crm_AiUsageLog.aggregate({
        where: {
            team_id: teamId,
            created_at: { gte: monthStart },
        },
        _sum: {
            total_tokens: true,
        },
    });

    return NextResponse.json({
        email: {
            used: quota?.emails_sent ?? 0,
            limit: planLimits.emails_per_month,
        },
        sms: {
            used: quota?.sms_sent ?? 0,
            limit: planLimits.sms_per_month,
        },
        voice: {
            used: quota?.voice_minutes_used ?? 0,
            limit: planLimits.voice_minutes_per_month,
        },
        ai_tokens: {
            used: aiLogs._sum.total_tokens ?? 0,
            limit: planLimits.ai_tokens,
        },
    });
}
