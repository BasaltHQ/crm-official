"use server";

import { prismadb } from "@/lib/prisma";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";

export async function updateProductBundles(productId: string, bundles: { childProductId: string, quantity: number, isRequired: boolean }[]) {
    try {
        const { error, teamInfo } = await getSessionAndTeam();
        if (error || !teamInfo) throw new Error("Unauthorized");

        const parentProduct = await prismadb.crm_Products.findUnique({
            where: { id: productId },
            select: { id: true, team_id: true },
        });
        if (!parentProduct) {
            return { success: false, error: "Product not found" };
        }
        if (!validateResourceOwnership(teamInfo.teamId, parentProduct.team_id, teamInfo.isPlatformAdmin)) {
            return { success: false, error: "Forbidden" };
        }

        const childIds = Array.from(new Set((bundles || []).map((b) => b.childProductId).filter(Boolean)));
        if (childIds.length > 0 && parentProduct.team_id && !teamInfo.isPlatformAdmin) {
            const validChildren = await prismadb.crm_Products.count({
                where: { id: { in: childIds }, team_id: parentProduct.team_id },
            });
            if (validChildren !== childIds.length) {
                return { success: false, error: "Forbidden — child products must belong to your team" };
            }
        }

        // Simple approach: Delete existing and recreate
        await prismadb.crm_ProductBundles.deleteMany({
            where: {
                parentProductId: productId
            }
        });

        if (bundles.length > 0) {
            await prismadb.crm_ProductBundles.createMany({
                data: bundles.map(b => ({
                    parentProductId: productId,
                    childProductId: b.childProductId,
                    quantity: b.quantity,
                    isRequired: b.isRequired
                }))
            });
        }

        revalidatePath("/crm/products");
        return { success: true };
    } catch (error: any) {
        systemLogger.error("[UPDATE_PRODUCT_BUNDLES]", error);
        return { success: false, error: error.message };
    }
}
