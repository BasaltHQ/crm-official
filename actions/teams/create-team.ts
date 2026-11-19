"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { normalizeTeamSlug, requirePlatformAdmin } from "@/lib/security/authz";

export const createTeam = async (name: string, slug: string, planId?: string) => {
    try {
        const admin = await requirePlatformAdmin();
        if (!admin) {
            return { error: "Unauthorized: Platform Admin required." };
        }

        const normalizedSlug = normalizeTeamSlug(slug || name);
        if (!normalizedSlug) {
            return { error: "Invalid team slug" };
        }

        // Check if slug exists (case-insensitive)
        const existing = await prismadb.team.findFirst({
            where: {
                slug: { equals: normalizedSlug, mode: "insensitive" },
            },
        });

        if (existing) {
            return { error: "Team with this ID already exists" };
        }

        // Resolve plan: use provided planId or default to STARTER (fallback FREE) tier
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

        const team = await prismadb.team.create({
            data: {
                name: String(name).trim(),
                slug: normalizedSlug,
                plan_id: resolvedPlanId,
                subscription_plan: (selectedPlan?.slug || "STARTER") as any,
                renewal_date: renewalDate,
            },
        });

        revalidatePath("/partners");
        return { success: true, team };
    } catch (error) {
        systemLogger.error("[CREATE_TEAM]", error);
        return { error: "Internal Error" };
    }
};
