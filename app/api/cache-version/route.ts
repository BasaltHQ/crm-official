import { NextResponse } from "next/server";
import { getCacheVersion } from "@/lib/cache-version";

/**
 * GET /api/cache-version
 * Returns the current cache version for clients to check against their stored version
 */
export async function GET() {
    return NextResponse.json({
        version: String(getCacheVersion()),
        timestamp: new Date().toISOString()
    });
}
