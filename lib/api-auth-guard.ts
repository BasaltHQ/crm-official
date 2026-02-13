/**
 * Centralized API Authentication Guard
 *
 * Provides a lightweight wrapper that enforces `getServerSession` on API route
 * handlers. Import `requireApiAuth()` at the top of any handler to get a
 * guaranteed session (or an automatic 401 response).
 *
 * Usage:
 * ```ts
 * import { requireApiAuth } from "@/lib/api-auth-guard";
 *
 * export async function GET() {
 *   const session = await requireApiAuth();
 *   if (session instanceof Response) return session; // 401
 *   // session is now a valid Session object
 * }
 * ```
 */
import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Verifies the caller has a valid server-side session.
 *
 * @returns A `Session` on success, or a `NextResponse` (401) on failure.
 *          Callers should check `instanceof Response` and return early.
 */
export async function requireApiAuth(): Promise<Session | NextResponse> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return NextResponse.json(
            { error: "Unauthorized — valid session required" },
            { status: 401 }
        );
    }

    return session;
}

/**
 * Verifies the caller has admin privileges in the current session.
 *
 * @returns A `Session` on success, or a `NextResponse` (401/403) on failure.
 */
export async function requireAdminAuth(): Promise<Session | NextResponse> {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    // @ts-expect-error — isAdmin is set in the session callback in auth.ts
    if (!session.user.isAdmin && !session.user.is_account_admin) {
        return NextResponse.json(
            { error: "Forbidden — admin privileges required" },
            { status: 403 }
        );
    }

    return session;
}

/**
 * Verifies cron requests by checking the `Authorization` header against
 * CRON_SECRET. Use this for `/api/cron/*` endpoints.
 *
 * @returns `true` if authorized, or a `NextResponse` (401) if not.
 */
export function requireCronAuth(request: Request): true | NextResponse {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (!cronSecret) {
        console.error("[requireCronAuth] CRON_SECRET is not set");
        return NextResponse.json(
            { error: "Server misconfiguration" },
            { status: 500 }
        );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: "Unauthorized — invalid cron secret" },
            { status: 401 }
        );
    }

    return true;
}
