"use server";

import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function getSavedReports() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
        return [];
    }

    try {
        const reports = await prismadb.savedReport.findMany({
            where: {
                userId: session.user.id,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        return reports;
    } catch (error) {
        console.error("Failed to fetch saved reports:", error);
        return [];
    }
}
