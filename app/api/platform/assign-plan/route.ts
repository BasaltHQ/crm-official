import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { resetLeadGenCredits } from "@/lib/scraper/credits";
import { resetAiTokenBalance } from "@/lib/ai-tokens";
import { requirePlatformAdmin } from "@/lib/security/authz";

/**
 * POST /api/platform/assign-plan
 * Assigns a subscription plan to a team (platform admin only)
 */
export async function POST(req: Request) {
    const admin = await requirePlatformAdmin();
    if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { teamId, planSlug } = await req.json();

    if (!teamId || !planSlug) {
        return NextResponse.json({ error: "teamId and planSlug required" }, { status: 400 });
    }

    // Block assignment to department-type teams — departments inherit from parent org
    const targetTeam = await prismadb.team.findUnique({
        where: { id: teamId },
        select: { team_type: true },
    });

    if ((targetTeam as any)?.team_type === "DEPARTMENT") {
        return NextResponse.json(
            { error: "Departments inherit their parent organization's plan. Assign the plan to the parent company instead." },
            { status: 400 }
        );
    }

    // Case-insensitive slug lookup (DB slugs are uppercase like "GROWTH")
    const dbPlan = await prismadb.plan.findFirst({
        where: { slug: { equals: planSlug, mode: "insensitive" } }
    }).catch(() => null);

    // Always sync both fields
    const updatePayload: any = {
        subscription_plan: dbPlan?.slug || planSlug.toUpperCase(),
    };
    if (dbPlan?.id) {
        updatePayload.plan_id = dbPlan.id;
    }

    try {
        await prismadb.team.update({
            where: { id: teamId },
            data: updatePayload,
        });
    } catch (e) {
        console.error("Prisma update failed:", e);
        return NextResponse.json({ error: "Database error assigning plan" }, { status: 500 });
    }

    // Reset AI Credits & Tokens to match the new plan's limits
    try {
        await resetLeadGenCredits(teamId);
        await resetAiTokenBalance(teamId);
    } catch (e) {
        console.error("Failed to reset AI credits during plan assignment:", e);
    }

    return NextResponse.json({ success: true });
}
