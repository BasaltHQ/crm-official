import { prismadb } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { resolveSlug } from "@/config/subscriptions";

const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;

export async function validateApiKey(req: Request) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return { error: "Missing or formatted Authorization header. Expected 'Bearer sk_live_...'", status: 401 };
    }

    const token = authHeader.split(" ")[1];
    if (!token.startsWith("sk_live_") || token.length < 20) {
        return { error: "Invalid API Key format.", status: 401 };
    }

    // Extract the identifying prefix (first 12 chars: sk_live_XXXX)
    const keyIdentifier = token.substring(0, 12);

    try {
        // Retrieve the hashed key matching this identifier
        const apiKeyRecord = await prismadb.crm_ApiKeys.findFirst({
            where: {
                key_prefix: keyIdentifier,
                status: "ACTIVE" // Ensure the key isn't revoked
            },
            include: {
                team: {
                    include: {
                        assigned_plan: { select: { slug: true } },
                    },
                },
            }
        });

        if (!apiKeyRecord) {
            return { error: "Invalid or revoked API Key.", status: 401 };
        }

        // Securely compare the supplied full token against the stored bcrypt hash
        const isValid = await bcrypt.compare(token, apiKeyRecord.key_hash);
        
        if (!isValid) {
            return { error: "Invalid API Key.", status: 401 };
        }

        // Resolve DEPARTMENT parent_id to parent organization for plan & rate-limit enforcement
        let billingTeam: any = apiKeyRecord.team;
        if (billingTeam?.team_type === "DEPARTMENT" && billingTeam.parent_id) {
            const parentOrg = await prismadb.team.findUnique({
                where: { id: billingTeam.parent_id },
                include: { assigned_plan: { select: { slug: true } } },
            });
            if (parentOrg) {
                billingTeam = parentOrg;
            }
        }

        if (!billingTeam || billingTeam.status === "SUSPENDED") {
            return { error: "Organization is inactive or suspended.", status: 403 };
        }

        const billingTeamId = billingTeam.id || apiKeyRecord.tenant_id;
        const rawPlan = billingTeam.assigned_plan?.slug || billingTeam.subscription_plan || "STARTER";
        const plan = resolveSlug(rawPlan);

        // ── Rate Limiting (Phase 2 Configuration) ──
        if (redis) {
            let callLimit = 100; // Starter gets 100/30d
            if (plan === "GROWTH") callLimit = 1500;
            if (plan === "SCALE") callLimit = 5000;
            if (plan === "ENTERPRISE" || plan === "EXEMPT") callLimit = 100000;

            const ratelimit = new Ratelimit({
                redis: redis,
                limiter: Ratelimit.fixedWindow(callLimit, "30 d"),
                analytics: true,
                prefix: "@upstash/ratelimit",
            });

            // ratelimit:${billingTeamId}:${month_year}
            const date = new Date();
            const monthYear = `${date.getMonth() + 1}_${date.getFullYear()}`;
            const identifier = `api_ratelimit:${billingTeamId}:${monthYear}`;

            const { success, limit } = await ratelimit.limit(identifier);

            if (!success) {
                return { 
                    error: `Rate limit exceeded. Your plan (${plan}) allows ${limit} requests per 30 days.`, 
                    status: 429 
                };
            }
        }

        // If valid, update the "last_used" timestamp securely (fire and forget to not block response)
        prismadb.crm_ApiKeys.update({
            where: { id: apiKeyRecord.id },
            data: { last_used: new Date() }
        }).catch((e: any) => console.error("Failed to update API key last_use", e));

        // Return the verified context (tenant_id)
        return {
            tenantId: apiKeyRecord.tenant_id,
            apiKeyId: apiKeyRecord.id,
            status: 200
        };

    } catch (e: any) {
        console.error("[API_KEY_VALIDATION_ERROR]", e);
        return { error: "Internal Server Error during key validation", status: 500 };
    }
}
