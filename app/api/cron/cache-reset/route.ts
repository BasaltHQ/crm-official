import { NextResponse } from "next/server";
import { invalidateCacheVersion } from "@/lib/cache-version";
import { systemLogger } from "@/lib/logger";
import { requireCronAuth } from "@/lib/api-auth-guard";

/**
 * POST /api/cron/cache-reset
 * 
 * Cron job endpoint called at 12 AM PST daily to invalidate global cache.
 * Protected by CRON_SECRET environment variable.
 * 
 * Vercel Cron schedule: "0 8 * * *" (8:00 UTC = 00:00 PST)
 */
export async function POST(req: Request) {
    try {
        const cronAuth = requireCronAuth(req);
        if (cronAuth instanceof Response) return cronAuth;

        const newVersion = invalidateCacheVersion();

        systemLogger.error(`[CRON] Cache reset triggered at ${new Date().toISOString()}`);

        return NextResponse.json({
            success: true,
            version: String(newVersion),
            timestamp: new Date().toISOString(),
            message: "Cache version invalidated. Active clients will refresh on next poll."
        });
    } catch (error: any) {
        systemLogger.error("[CRON] Cache reset failed:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to reset cache" },
            { status: 500 }
        );
    }
}

// Also support GET for manual testing (protected)
export async function GET(req: Request) {
    return POST(req);
}
