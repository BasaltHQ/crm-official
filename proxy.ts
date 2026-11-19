/**
 * Next.js 16 Root Proxy (Middleware) — Security Headers, CORS, Rate Limiting & JWT API Guard
 */
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { getToken } from "next-auth/jwt";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ALLOWED_ORIGINS = new Set([
    process.env.NEXT_PUBLIC_APP_URL || "https://crm.basalthq.com",
    "https://crm.basalthq.com",
    "http://localhost:3000",
    "http://localhost:3001",
]);

const PUBLIC_API_PREFIXES = [
    "/api/auth",
    "/api/user/passwordReset",
    "/api/user/resetPasswordWithToken",
    "/api/docs",
    "/api/forms/public",
    "/api/forms/submit",
    "/api/outreach/track",
    "/api/outreach/open",
    "/api/outreach/unsubscribe",
    "/api/outreach/icon",
    "/api/email/track",
    "/api/portal",
    "/api/cron",
    "/api/webhooks",
    "/api/resend/webhook",
    "/api/azure/webhook",
    "/api/email/inbound",
    "/api/voice/engage/webhook",
    "/api/voice/azure/answer",
    "/api/voice/elevenlabs/call-status",
    "/api/voice/elevenlabs/pre-call",
    "/api/voice/realtime/events",
    "/api/workflows/webhook",
    "/api/workflows/scheduler/tick",
    "/api/reports/scheduler/tick",
    "/api/upload/cron",
    "/api/v1",
    "/api/synthesis/trigger",
    "/api/crm/cases/email-to-case",
    "/api/crm/contacts/create-from-remote",
    "/api/crm/leads/create-lead-from-web",
    "/api/oauth/token",
    "/api/media/",
];

const PUBLIC_EXACT_ROUTES: Record<string, string[]> = {
    "/api/user": ["POST"],
    "/api/og": ["GET"],
    "/api/footer": ["GET"],
    "/api/social": ["GET"],
    "/api/blog": ["GET"],
    "/api/careers": ["GET"],
    "/api/cache-version": ["GET"],
    "/api/verify": ["GET", "POST"],
    "/api/contact/enterprise": ["POST"],
    "/api/analytics/track": ["POST"],
    "/api/support/create": ["POST"],
};

const RATE_LIMIT_EXEMPT_EXACT = new Set([
    "/api/auth/session",
    "/api/auth/providers",
    "/api/auth/csrf",
]);

const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_MAX_PASSWORD_RESET = 3;
const RATE_LIMIT_MAX_AUTH_ATTEMPTS = 8;
const RATE_LIMIT_MAX_MFA_VERIFY = 10;

let redisClient: Redis | null = null;
try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redisClient = Redis.fromEnv();
    }
} catch {
    console.warn("Upstash Redis not configured, falling back to local rate limiter");
}

let ratelimitDefault: Ratelimit | null = null;
let ratelimitAuth: Ratelimit | null = null;
let ratelimitPassword: Ratelimit | null = null;
let ratelimitMfa: Ratelimit | null = null;

if (redisClient) {
    ratelimitDefault = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_REQUESTS, "1 m"),
        analytics: true,
    });
    ratelimitAuth = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_AUTH_ATTEMPTS, "1 m"),
        analytics: true,
    });
    ratelimitPassword = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_PASSWORD_RESET, "1 m"),
        analytics: true,
    });
    ratelimitMfa = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX_MFA_VERIFY, "1 m"),
        analytics: true,
    });
}

type RateLimitEntry = { count: number; resetAt: number };
const localRateLimitMap = new Map<string, RateLimitEntry>();
let lastLocalCleanup = Date.now();

function cleanupLocalRateLimit() {
    const now = Date.now();
    if (now - lastLocalCleanup < 30_000) return;
    lastLocalCleanup = now;
    localRateLimitMap.forEach((entry, key) => {
        if (now > entry.resetAt) {
            localRateLimitMap.delete(key);
        }
    });
}

async function checkRateLimit(
    key: string,
    limitType: "DEFAULT" | "AUTH" | "PASSWORD" | "MFA"
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    if (redisClient) {
        let limiter = ratelimitDefault!;
        if (limitType === "AUTH") limiter = ratelimitAuth!;
        if (limitType === "PASSWORD") limiter = ratelimitPassword!;
        if (limitType === "MFA") limiter = ratelimitMfa!;

        try {
            const { success, remaining, reset } = await limiter.limit(key);
            return { allowed: success, remaining, resetAt: reset };
        } catch (error) {
            console.error("Redis Rate Limit Error:", error);
            return { allowed: true, remaining: 1, resetAt: Date.now() + 60000 };
        }
    }

    cleanupLocalRateLimit();
    let maxLocal = RATE_LIMIT_MAX_REQUESTS;
    if (limitType === "AUTH") maxLocal = RATE_LIMIT_MAX_AUTH_ATTEMPTS;
    if (limitType === "PASSWORD") maxLocal = RATE_LIMIT_MAX_PASSWORD_RESET;
    if (limitType === "MFA") maxLocal = RATE_LIMIT_MAX_MFA_VERIFY;

    const now = Date.now();
    const existing = localRateLimitMap.get(key);

    if (!existing || now > existing.resetAt) {
        const resetAt = now + 60000;
        localRateLimitMap.set(key, { count: 1, resetAt });
        return { allowed: true, remaining: maxLocal - 1, resetAt };
    }

    existing.count += 1;
    const allowed = existing.count <= maxLocal;
    return { allowed, remaining: Math.max(0, maxLocal - existing.count), resetAt: existing.resetAt };
}

function getClientIp(request: NextRequest): string {
    const cfIp = request.headers.get("cf-connecting-ip")?.trim();
    if (cfIp) return cfIp;

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp;

    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
        const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
        // Prefer rightmost hop appended by the reverse proxy to prevent leftmost XFF spoofing
        if (hops.length > 0) return hops[hops.length - 1];
    }

    return "unknown";
}

function isPublicApi(pathname: string, method: string): boolean {
    const exactMethods = PUBLIC_EXACT_ROUTES[pathname];
    if (exactMethods && exactMethods.includes(method.toUpperCase())) {
        return true;
    }
    return PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isRateLimitExempt(pathname: string, method: string): boolean {
    if (method === "GET" && RATE_LIMIT_EXEMPT_EXACT.has(pathname)) {
        return true;
    }
    return pathname.startsWith("/_next") || pathname === "/favicon.ico";
}

function applySecurityHeaders(response: NextResponse, requestId?: string): void {
    if (requestId) {
        response.headers.set("X-Request-ID", requestId);
    }
    response.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload"
    );
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=()"
    );
    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set(
        "Content-Security-Policy",
        [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://challenges.cloudflare.com https://use.typekit.net https://static.cloudflareinsights.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://use.typekit.net https://p.typekit.net",
            "font-src 'self' https://fonts.gstatic.com https://use.typekit.net https://p.typekit.net data:",
            "img-src 'self' data: blob: https: http: https://p.typekit.net",
            "connect-src 'self' https: wss: https://*.typekit.net",
            "frame-src 'self' https://accounts.google.com https://challenges.cloudflare.com https://surge.basalthq.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self' https://surge.basalthq.com",
        ].join("; ")
    );
}

function applyCors(request: NextRequest, response: NextResponse): NextResponse {
    const origin = request.headers.get("origin");
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Vary", "Origin");
    }
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, x-wallet, x-csrf-token"
    );
    response.headers.set("Access-Control-Max-Age", "86400");
    response.headers.set("Access-Control-Allow-Credentials", "true");
    return response;
}

async function verifyRequestJwt(request: NextRequest) {
    const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) return null;
    try {
        return (
            (await getToken({ req: request, secret })) ||
            (await getToken({ req: request, secret, cookieName: "__Secure-next-auth.session-token" })) ||
            (await getToken({ req: request, secret, cookieName: "next-auth.session-token" }))
        );
    } catch {
        return null;
    }
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
    const { pathname } = request.nextUrl;
    const method = request.method;
    const isApiRoute = pathname.startsWith("/api/");

    const requestId = crypto.randomUUID();
    request.headers.set("X-Request-ID", requestId);

    if (method === "OPTIONS" && isApiRoute) {
        const preflightResponse = new NextResponse(null, { status: 204 });
        applyCors(request, preflightResponse);
        return preflightResponse;
    }

    if (isApiRoute && !isRateLimitExempt(pathname, method)) {
        const clientIp = getClientIp(request);

        const isPasswordReset =
            pathname.startsWith("/api/user/passwordReset") ||
            pathname.startsWith("/api/user/resetPasswordWithToken");
        const isMfa =
            pathname.startsWith("/api/user/mfa/") ||
            pathname.startsWith("/api/auth/mfa/");
        const isLogin =
            pathname.includes("/api/auth/callback/credentials") ||
            pathname.startsWith("/api/auth/thirdweb") ||
            (pathname === "/api/user" && method === "POST");

        let limitType: "DEFAULT" | "AUTH" | "PASSWORD" | "MFA" = "DEFAULT";
        let rateLimitKey = `api:${clientIp}`;

        if (isPasswordReset) {
            limitType = "PASSWORD";
            rateLimitKey = `pw:${clientIp}`;
        } else if (isMfa) {
            limitType = "MFA";
            rateLimitKey = `mfa:${clientIp}`;
        } else if (isLogin) {
            limitType = "AUTH";
            rateLimitKey = `login:${clientIp}`;
        }

        const { allowed, remaining, resetAt } = await checkRateLimit(rateLimitKey, limitType);

        if (!allowed) {
            const retryAfter = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
            const rateLimitedResponse = NextResponse.json(
                { error: "Too many requests. Please try again later." },
                { status: 429 }
            );
            rateLimitedResponse.headers.set("Retry-After", String(retryAfter));
            rateLimitedResponse.headers.set("X-RateLimit-Limit", "exceeded");
            rateLimitedResponse.headers.set("X-RateLimit-Remaining", "0");
            rateLimitedResponse.headers.set("X-RateLimit-Reset", String(resetAt));
            applySecurityHeaders(rateLimitedResponse, requestId);
            return rateLimitedResponse;
        }

        let verifiedToken: any = null;
        if (!isPublicApi(pathname, method)) {
            verifiedToken = await verifyRequestJwt(request);
            if (!verifiedToken) {
                const unauthorizedResponse = NextResponse.json(
                    { error: "Unauthorized access detected." },
                    { status: 401 }
                );
                applyCors(request, unauthorizedResponse);
                applySecurityHeaders(unauthorizedResponse, requestId);
                return unauthorizedResponse;
            }
        }

        // Only fire AI Synthesis trigger AFTER authentication succeeds and ONLY when SYNTHESIS_SECRET is explicitly configured
        if (
            verifiedToken &&
            process.env.SYNTHESIS_SECRET &&
            ["POST", "PUT", "PATCH", "DELETE"].includes(method) &&
            (pathname.startsWith("/api/crm/") || pathname.startsWith("/api/outreach/") || pathname.startsWith("/api/finance/"))
        ) {
            let payload = null;
            try {
                payload = await request.clone().json();
            } catch {
                // Non-JSON payload
            }

            const synthesisTriggerUrl = `${request.nextUrl.origin}/api/synthesis/trigger`;
            const synthesisRequest = fetch(synthesisTriggerUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-synthesis-secret": process.env.SYNTHESIS_SECRET,
                },
                body: JSON.stringify({
                    path: pathname,
                    method,
                    payload,
                    timestamp: new Date().toISOString(),
                }),
            }).catch((err) => {
                console.error("[Proxy] Synthesis Trigger Error:", err);
            });

            event.waitUntil(synthesisRequest);
        }

        const response = NextResponse.next();
        response.headers.set("X-RateLimit-Limit", limitType);
        response.headers.set("X-RateLimit-Remaining", String(remaining));
        response.headers.set("X-RateLimit-Reset", String(resetAt));
        applyCors(request, response);
        applySecurityHeaders(response, requestId);
        return response;
    }

    const response = NextResponse.next();
    applySecurityHeaders(response, requestId);
    if (isApiRoute) {
        applyCors(request, response);
    }
    return response;
}

export default proxy;

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    ],
};

