
"use server";

import { prismadb } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/security/authz";

export async function createPlan(data: any) {
    const admin = await requirePlatformAdmin();
    if (!admin) return { error: "Forbidden" };

    try {
        await prismadb.plan.create({
            data: {
                name: data.name,
                slug: data.slug.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, ''),
                price: data.price,
                currency: data.currency,
                max_users: data.max_users,
                max_storage: data.max_storage,
                max_credits: data.max_credits,
                leadgen_credits_monthly: data.leadgen_credits_monthly,
                ai_tokens_included: data.ai_tokens_included,
                features: data.features,
                isActive: data.isActive,
                billing_cycle: data.billing_cycle,
                grace_period_days: Number(data.grace_period_days),
            }
        });
        revalidatePath("/partners/plans");
        return { success: "Plan created" };
    } catch (error) {
        console.error("Create Plan Error:", error);
        return { error: "Failed to create plan" };
    }
}

export async function updatePlan(id: string, data: any) {
    const admin = await requirePlatformAdmin();
    if (!admin) return { error: "Forbidden" };

    try {
        await prismadb.plan.update({
            where: { id },
            data: {
                name: data.name,
                slug: data.slug.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, ''),
                price: data.price,
                currency: data.currency,
                max_users: data.max_users,
                max_storage: data.max_storage,
                max_credits: data.max_credits,
                leadgen_credits_monthly: data.leadgen_credits_monthly,
                ai_tokens_included: data.ai_tokens_included,
                features: data.features,
                isActive: data.isActive,
                billing_cycle: data.billing_cycle,
                grace_period_days: Number(data.grace_period_days),
            }
        });
        revalidatePath("/partners/plans");
        return { success: "Plan updated" };
    } catch (error) {
        console.error("Update Plan Error:", error);
        return { error: "Failed to update plan" };
    }
}

export async function deletePlan(id: string) {
    const admin = await requirePlatformAdmin();
    if (!admin) return { error: "Forbidden" };

    try {
        // Check if used
        const used = await prismadb.team.findFirst({
            where: { plan_id: id }
        });

        if (used) {
            return { error: "Cannot delete plan: It is assigned to one or more teams." };
        }

        await prismadb.plan.delete({
            where: { id }
        });
        revalidatePath("/partners/plans");
        return { success: "Plan deleted" };
    } catch (error) {
        console.error("Delete Plan Error:", error);
        return { error: "Failed to delete plan" };
    }
}

export async function getPlans() {
    const admin = await requirePlatformAdmin();
    const plans = await prismadb.plan.findMany({
        ...(admin
            ? {}
            : {
                  where: {
                      isActive: true,
                      slug: { in: ["STARTER", "GROWTH", "SCALE"] },
                  },
              }),
        orderBy: { price: 'asc' }
    });
    return plans;
}
