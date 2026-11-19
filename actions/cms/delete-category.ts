"use server";

import { prismadb } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";

export async function deleteCategory(categoryName: string) {
    const admin = await requirePlatformAdmin();
    if (!admin) {
        throw new Error("Forbidden — platform administrator privileges required");
    }

    if (!categoryName) throw new Error("Category name is required");

    try {
        const result = await prismadb.docArticle.deleteMany({
            where: {
                category: categoryName
            }
        });

        revalidatePath("/cms/docs");
        revalidatePath("/docs");

        return { success: true, count: result.count };
    } catch (error) {
        systemLogger.error("[DELETE_CATEGORY_ERROR]", error);
        throw new Error("Failed to delete category");
    }
}
