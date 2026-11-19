"use server";

import { prismadb } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getActiveAiModels() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || session.error === "SessionInvalidated") {
            return [];
        }
        const systemConfigs = await prismadb.systemAiConfig.findMany({
            where: { isActive: true },
            select: { id: true, modelId: true, provider: true }
        });
        
        // Strip duplicate models if any
        const models = Array.from(new Set(systemConfigs.map((c: any) => c.modelId))).map(id => {
            return systemConfigs.find((c: any) => c.modelId === id);
        }).filter(Boolean);

        return models.map((m) => ({
            id: m!.id,
            label: `${m!.provider}: ${m!.modelId.split('/').pop()?.split(':').shift() || m!.modelId}`,
            value: m!.modelId
        }));
    } catch (e) {
        console.error("Error fetching AI models:", e);
        return [];
    }
}
