"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

export async function deleteReport(reportId: string) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // Verify the user owns this report
        const report = await prismadb.savedReport.findFirst({
            where: {
                id: reportId,
                userId: session.user.id,
            },
        });

        if (!report) {
            return { success: false, error: "Report not found" };
        }

        await prismadb.savedReport.delete({
            where: {
                id: reportId,
            },
        });

        revalidatePath("/reports");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete report:", error);
        return { success: false, error: "Failed to delete report" };
    }
}
