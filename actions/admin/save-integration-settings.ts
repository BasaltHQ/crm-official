
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { revalidatePath } from "next/cache";
import { systemLogger } from "@/lib/logger";
import { encryptSecret, isMaskedSecret } from "@/lib/encryption";
import { assertSafeExternalUrl } from "@/lib/security/ssrf-guard";

export async function saveIntegrationSettings(data: FormData) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id || (session as any).error === "SessionInvalidated") {
            return { error: "Unauthorized" };
        }

        const teamInfo = await getCurrentUserTeamId();
        if (!teamInfo?.isAdmin) {
            return { error: "Forbidden" };
        }

        const teamId = teamInfo.teamId;
        if (!teamId) return { error: "No team context" };

        const existing = await prismadb.tenant_Integrations.findUnique({
            where: { tenant_id: teamId },
        });

        const resolveCardEnabled = (enabledKey: string, siblingKeys: string[], fallback?: boolean | null): boolean => {
            const raw = data.get(enabledKey);
            if (raw !== null) {
                return ["on", "true", "1"].includes(String(raw).toLowerCase());
            }
            const cardSubmitted = siblingKeys.some((k) => data.has(k));
            return cardSubmitted ? false : Boolean(fallback);
        };

        const resolveStringField = (key: string, fallback?: string | null): string | null => {
            const raw = data.get(key);
            if (raw === null) return fallback ?? null;
            const trimmed = String(raw).trim();
            return trimmed === "" ? null : trimmed;
        };

        const resolveSecretField = (key: string, fallback?: string | null): string | null => {
            const raw = data.get(key);
            if (raw === null) return fallback ?? null;
            const val = String(raw).trim();
            if (val === "") return null;
            if (isMaskedSecret(val)) return fallback ?? null;
            return encryptSecret(val);
        };

        // Extract Surge Settings
        const surgeEnabled = resolveCardEnabled(
            "surge_enabled",
            ["surge_api_key", "surge_merchant_id"],
            existing?.surge_enabled
        );
        const surgeApiKey = resolveSecretField("surge_api_key", existing?.surge_api_key);
        const surgeMerchantId = resolveStringField("surge_merchant_id", existing?.surge_merchant_id);

        // Extract Mercury Settings
        const mercuryEnabled = resolveCardEnabled(
            "mercury_enabled",
            ["mercury_api_key", "mercury_account_id"],
            existing?.mercury_enabled
        );
        const mercuryApiKey = resolveSecretField("mercury_api_key", existing?.mercury_api_key);
        const mercuryAccountId = resolveStringField("mercury_account_id", existing?.mercury_account_id);

        // Extract Shopify Settings
        const shopifyEnabled = resolveCardEnabled(
            "shopify_enabled",
            ["shopify_store_url", "shopify_access_token"],
            existing?.shopify_enabled
        );
        const shopifyStoreUrl = resolveStringField("shopify_store_url", existing?.shopify_store_url);
        const shopifyAccessToken = resolveSecretField("shopify_access_token", existing?.shopify_access_token);

        // Extract WooCommerce Settings
        const woocommerceEnabled = resolveCardEnabled(
            "woocommerce_enabled",
            ["woocommerce_store_url", "woocommerce_consumer_key", "woocommerce_consumer_secret"],
            existing?.woocommerce_enabled
        );
        const woocommerceStoreUrl = resolveStringField("woocommerce_store_url", existing?.woocommerce_store_url);
        const woocommerceConsumerKey = resolveSecretField("woocommerce_consumer_key", existing?.woocommerce_consumer_key);
        const woocommerceConsumerSecret = resolveSecretField(
            "woocommerce_consumer_secret",
            existing?.woocommerce_consumer_secret
        );

        // Extract Twilio Settings
        const twilioEnabled = resolveCardEnabled(
            "twilio_enabled",
            [
                "twilio_account_sid",
                "twilio_auth_token",
                "twilio_phone_number",
                "voice_agent_name",
                "elevenlabs_api_key",
                "elevenlabs_agent_id",
            ],
            existing?.twilio_enabled
        );
        const twilioAccountSid = resolveStringField("twilio_account_sid", existing?.twilio_account_sid);
        const twilioAuthToken = resolveSecretField("twilio_auth_token", existing?.twilio_auth_token);
        const twilioPhoneNumber = resolveStringField("twilio_phone_number", existing?.twilio_phone_number);
        const voiceAgentName = resolveStringField("voice_agent_name", existing?.voice_agent_name);
        const elevenlabsApiKey = resolveSecretField("elevenlabs_api_key", existing?.elevenlabs_api_key);
        const elevenlabsAgentId = resolveStringField("elevenlabs_agent_id", existing?.elevenlabs_agent_id);

        // Validate external store URLs if non-empty
        if (data.get("shopify_store_url") !== null && shopifyStoreUrl) {
            const candidateShopifyUrl = /^https?:\/\//i.test(shopifyStoreUrl)
                ? shopifyStoreUrl
                : `https://${shopifyStoreUrl}`;
            try {
                await assertSafeExternalUrl(candidateShopifyUrl, { allowHttp: false });
            } catch {
                return { error: "Invalid or disallowed Shopify Store URL." };
            }
        }

        if (data.get("woocommerce_store_url") !== null && woocommerceStoreUrl) {
            const candidateWooUrl = /^https?:\/\//i.test(woocommerceStoreUrl)
                ? woocommerceStoreUrl
                : `https://${woocommerceStoreUrl}`;
            try {
                await assertSafeExternalUrl(candidateWooUrl, { allowHttp: false });
            } catch {
                return { error: "Invalid or disallowed WooCommerce Store URL." };
            }
        }

        // Validate Surge
        if (surgeEnabled && (!surgeApiKey || !surgeMerchantId)) {
            return { error: "Surge API Key and ID are required when enabled." };
        }

        const persistedFields = {
            surge_enabled: surgeEnabled,
            surge_api_key: surgeApiKey,
            surge_merchant_id: surgeMerchantId,
            mercury_enabled: mercuryEnabled,
            mercury_api_key: mercuryApiKey,
            mercury_account_id: mercuryAccountId,
            shopify_enabled: shopifyEnabled,
            shopify_store_url: shopifyStoreUrl,
            shopify_access_token: shopifyAccessToken,
            woocommerce_enabled: woocommerceEnabled,
            woocommerce_store_url: woocommerceStoreUrl,
            woocommerce_consumer_key: woocommerceConsumerKey,
            woocommerce_consumer_secret: woocommerceConsumerSecret,
            twilio_enabled: twilioEnabled,
            twilio_account_sid: twilioAccountSid,
            twilio_auth_token: twilioAuthToken,
            twilio_phone_number: twilioPhoneNumber,
            voice_agent_name: voiceAgentName,
            elevenlabs_api_key: elevenlabsApiKey,
            elevenlabs_agent_id: elevenlabsAgentId,
        };

        // Update or Create
        await prismadb.tenant_Integrations.upsert({
            where: { tenant_id: teamId },
            create: {
                tenant_id: teamId,
                ...persistedFields,
                preferred_chain: existing?.preferred_chain || "BASE",
            },
            update: persistedFields,
        });

        revalidatePath("/admin/integrations");
        return { success: true };

    } catch (error) {
        systemLogger.error("[SaveIntegrations] Error:", error);
        return { error: "Failed to save settings." };
    }
}
