"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { normalizeTeamSlug, requirePlatformAdmin } from "@/lib/security/authz";

export async function moveMemberToNewTeam(
    userId: string,
    teamName: string,
    teamSlug: string,
    planId?: string
) {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { error: "Unauthorized: Platform Admin required." };
        }

        // 1. Verify user exists
        const targetUser = await (prismadb.users as any).findUnique({
            where: { id: userId },
            select: { id: true, email: true }
        });

        if (!targetUser) {
            return { error: "User not found" };
        }

        const normalizedSlug = normalizeTeamSlug(teamSlug || teamName);
        if (!normalizedSlug) {
            return { error: "Invalid team slug" };
        }

        // 2. Check if slug exists (case-insensitive)
        const existingTeam = await prismadb.team.findFirst({
            where: { slug: { equals: normalizedSlug, mode: "insensitive" } }
        });

        if (existingTeam) {
            return { error: `A team with slug "${normalizedSlug}" already exists.` };
        }

        // 3. Create the new team — default to STARTER (fallback FREE) plan if none specified
        let selectedPlan = planId
            ? await prismadb.plan.findUnique({ where: { id: planId } })
            : null;
        if (!selectedPlan) {
            selectedPlan =
                (await prismadb.plan.findFirst({ where: { slug: "STARTER" } })) ||
                (await prismadb.plan.findFirst({ where: { slug: "FREE" } }));
        }

        const resolvedPlanId = selectedPlan?.id;
        let renewalDate = null;
        if (selectedPlan) {
            const now = new Date();
            if (selectedPlan.billing_cycle === "MONTHLY") {
                renewalDate = new Date(now.setMonth(now.getMonth() + 1));
            } else if (selectedPlan.billing_cycle === "YEARLY") {
                renewalDate = new Date(now.setFullYear(now.getFullYear() + 1));
            }
        }

        const newTeam = await prismadb.team.create({
            data: {
                name: String(teamName).trim(),
                slug: normalizedSlug,
                owner_id: userId,
                plan_id: resolvedPlanId,
                subscription_plan: (selectedPlan?.slug || "STARTER") as any,
                renewal_date: renewalDate,
            }
        });

        // 4. Move the user and promote to OWNER
        await (prismadb.users as any).update({
            where: { id: userId },
            data: {
                team_id: newTeam.id,
                team_role: "OWNER"
            }
        });

        revalidatePath("/partners");
        revalidatePath(`/partners/${newTeam.id}`);

        return {
            success: true,
            message: `Successfully moved ${targetUser.email} to new team "${teamName}" as Owner.`
        };
    } catch (error) {
        systemLogger.error("[MOVE_MEMBER_TO_NEW_TEAM]", error);
        return { error: "Failed to move member to new team" };
    }
}
