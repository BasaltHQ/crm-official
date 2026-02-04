"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

export async function saveReport(data: {
    title: string;
    content: string;
    prompt?: string;
    filters?: any;
}) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const report = await prismadb.savedReport.create({
            data: {
                title: data.title,
                content: data.content,
                prompt: data.prompt,
                filters: data.filters,
                userId: session.user.id,
            },
        });

        revalidatePath("/reports");
        return { success: true, report };
    } catch (error) {
        console.error("Failed to save report:", error);
        return { success: false, error: "Failed to save report" };
    }
}
