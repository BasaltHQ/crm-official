import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { deliverScheduledReports } from "@/lib/reports/report-delivery";
import { systemLogger } from "@/lib/logger";
import { requireCronAuth } from "@/lib/api-auth-guard";

/**
 * POST /api/reports/scheduler/tick
 * Cron-triggered endpoint that delivers scheduled reports.
 * Call every minute (or every 5 minutes for lower volume).
 */
export async function POST(req: Request) {
    try {
        const cronAuth = requireCronAuth(req);
        if (cronAuth instanceof Response) return cronAuth;

        const result = await deliverScheduledReports();

        return NextResponse.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        systemLogger.error("[REPORT_SCHEDULER]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
