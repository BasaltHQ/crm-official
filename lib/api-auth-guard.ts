import { getServerSession, Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { normalizeRoleName } from "@/lib/security/authz";

export async function requireApiAuth(): Promise<Session | NextResponse> {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.error === "SessionInvalidated") {
        return NextResponse.json(
            { error: "Unauthorized — valid session required" },
            { status: 401 }
        );
    }

    if (session.user.userStatus && session.user.userStatus !== "ACTIVE") {
        return NextResponse.json(
            { error: "Forbidden — active account required" },
            { status: 403 }
        );
    }

    return session;
}

export async function requireAdminAuth(): Promise<Session | NextResponse> {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const normalizedRole = normalizeRoleName(session.user.team_role);
    const isTenantOrGlobalAdmin =
        session.user.isAdmin ||
        session.user.is_account_admin ||
        ["OWNER", "ADMIN", "SUPER_ADMIN", "PLATFORM_ADMIN"].includes(normalizedRole);

    if (!isTenantOrGlobalAdmin) {
        return NextResponse.json(
            { error: "Forbidden — admin privileges required" },
            { status: 403 }
        );
    }

    return session;
}

export async function requirePlatformAdminApi(): Promise<Session | NextResponse> {
    const session = await requireApiAuth();
    if (session instanceof NextResponse) return session;

    const normalizedRole = normalizeRoleName(session.user.team_role);
    if (!session.user.isAdmin && normalizedRole !== "PLATFORM_ADMIN") {
        return NextResponse.json(
            { error: "Forbidden — platform administrator privileges required" },
            { status: 403 }
        );
    }

    return session;
}

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
