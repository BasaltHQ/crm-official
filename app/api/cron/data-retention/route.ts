import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { requireCronAuth } from "@/lib/api-auth-guard";

const ALLOWED_RETENTION_MODELS: Record<string, { prismaKey: string; dateField: string }> = {
    systemActivity: { prismaKey: "systemActivity", dateField: "createdAt" },
    SystemActivity: { prismaKey: "systemActivity", dateField: "createdAt" },
    crm_AiUsageLog: { prismaKey: "crm_AiUsageLog", dateField: "createdAt" },
    crm_ApiLogs: { prismaKey: "crm_ApiLogs", dateField: "timestamp" },
    notification: { prismaKey: "notification", dateField: "createdAt" },
    Notification: { prismaKey: "notification", dateField: "createdAt" },
};

// This cron job should be called securely via CRON_SECRET
export async function GET(req: Request) {
    const cronAuth = requireCronAuth(req);
    if (cronAuth instanceof Response) return cronAuth;

    try {
        // Find all active retention policies
        const policies = await (prismadb as any).dataRetentionPolicy.findMany({
            where: { enabled: true }
        });

        const results = [];

        for (const policy of policies) {
            const { model_name, retention_days, action } = policy;

            const targetModel = ALLOWED_RETENTION_MODELS[String(model_name || "")];
            if (!targetModel) {
                console.warn(`[DATA_RETENTION] Skipping disallowed model_name: ${model_name}`);
                results.push({ model_name, error: "Disallowed retention model", status: "skipped" });
                continue;
            }
            
            // Calculate cutoff date
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retention_days);

            // Execute action based on policy
            if (action === "DELETE") {
                try {
                    const result = await (prismadb as any)[targetModel.prismaKey].deleteMany({
                        where: {
                            [targetModel.dateField]: {
                                lt: cutoffDate
                            }
                        }
                    });
                    results.push({ model_name, deleted: result.count, status: "success" });
                } catch (err: any) {
                    console.error(`Failed to execute retention policy on ${model_name}`, err);
                    results.push({ model_name, error: err.message, status: "failed" });
                }
            } else if (action === "ANONYMIZE") {
                // Future implementation if ANONYMIZE is used instead of DELETE
                results.push({ model_name, status: "anonymize pending implementation" });
            }
        }

        // SOC2 CC6.5: Specifically clear old unverified OTPs and Auth tokens
        const oldTokenCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
        
        // 1. Clear OAuth Authorization Codes
        const deletedOAuth = await (prismadb as any).oauth_Authorization_Codes.deleteMany({
            where: {
                OR: [
                    { expiresAt: { lt: new Date() } },
                    { used: true }
                ]
            }
        });
        results.push({ model_name: "oauth_Authorization_Codes", deleted: deletedOAuth.count, status: "success" });
        
        return NextResponse.json({ message: "Data Retention Job Finished", policies_applied: policies.length, results }, { status: 200 });

    } catch (error: any) {
        console.error("Data Retention Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
