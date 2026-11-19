import { createAzure } from "@ai-sdk/azure";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createMistral } from "@ai-sdk/mistral";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { prismadb } from "@/lib/prisma";
import { decryptSecret } from "@/lib/encryption";
import { consumeAiTokens } from "@/lib/ai-tokens";
import { assertSafeExternalUrl } from "@/lib/security/ssrf-guard";

// ---------------------------------------------------------------------------
// AI Service Type — formalizes the `service` label used in crm_AiUsageLog
// ---------------------------------------------------------------------------
export type AiService =
    | "chat"           // Varuni general-purpose agent
    | "email"          // Outreach email generation
    | "email_reply"    // Auto-reply generation
    | "email_preview"  // Email preview generation
    | "sms"            // SMS body generation
    | "sms_preview"    // SMS preview generation
    | "sentiment"      // Inbound reply sentiment analysis
    | "enrichment"     // LeadGen enrichment (scraper AI)
    | "lead_scoring"   // AI lead scoring
    | "synthesis"      // Synthesis layer
    | "deal_agent"     // Deal agent
    | "form_enhance"   // Form AI enhancement
    | "prompt_compose" // Prompt composition
    | "general"        // General completion
    | "calendar"       // Calendar briefing
    | "followup"       // Follow-up email generation
    | "pool_analysis"  // Pool import analysis
    | "pdf_wizard"     // PDF to Excel extraction
    | (string & {});   // Extensible for future services

export function isReasoningModel(modelId: string | undefined | null): boolean {
    if (!modelId) return false;
    return modelId.toLowerCase().includes("o1") ||
        modelId.toLowerCase().includes("gpt-5") ||
        modelId.toLowerCase().includes("deepseek-reasoner");
}

/**
 * Low-level factory to create an AI model instance from any provider.
 */
async function createProviderModel(
    providerSlug: string,
    modelId: string,
    apiKey?: string,
    resourceName?: string,
    baseURL?: string
) {
    // Look up provider registry for sdkType and default baseUrl
    let sdkType = "OPENAI_COMPATIBLE";
    let registryBaseUrl: string | undefined;
    try {
        const registry = await prismadb.aiProviderRegistry.findUnique({ where: { slug: providerSlug } });
        if (registry) {
            sdkType = registry.sdkType;
            registryBaseUrl = registry.baseUrl || undefined;
        }
    } catch { /* Registry may not be seeded yet */ }

    // Fallback: infer sdkType from known built-in provider slugs
    if (!sdkType || sdkType === "OPENAI_COMPATIBLE") {
        const slugOverrides: Record<string, string> = {
            ANTHROPIC: "ANTHROPIC",
            GOOGLE: "GOOGLE",
            AZURE: "AZURE",
            MISTRAL: "MISTRAL",
            BEDROCK: "BEDROCK",
            AWS: "BEDROCK",
        };
        sdkType = slugOverrides[providerSlug] || "OPENAI_COMPATIBLE";
    }

    const cleanUrl = (url: string | undefined): string | undefined => {
        if (!url) return undefined;
        return url.endsWith('/') ? url.slice(0, -1) : url;
    };

    let effectiveBaseURL = cleanUrl(baseURL || registryBaseUrl);
    if (effectiveBaseURL) {
        const validated = await assertSafeExternalUrl(effectiveBaseURL, { allowHttp: false });
        effectiveBaseURL = cleanUrl(validated.toString());
    }

    const builtInBaseUrls: Record<string, string> = {
        GROK: "https://api.x.ai/v1",
        DEEPSEEK: "https://api.deepseek.com",
        PERPLEXITY: "https://api.perplexity.ai",
    };

    const envKeyMap: Record<string, string> = {
        OPENAI: "OPENAI_API_KEY",
        AZURE: "AZURE_OPENAI_API_KEY",
        ANTHROPIC: "ANTHROPIC_API_KEY",
        GOOGLE: "GOOGLE_GENERATIVE_AI_API_KEY",
        GROK: "XAI_API_KEY",
        DEEPSEEK: "DEEPSEEK_API_KEY",
        PERPLEXITY: "PERPLEXITY_API_KEY",
        MISTRAL: "MISTRAL_API_KEY",
    };
    const envKey = envKeyMap[providerSlug];
    const effectiveApiKey = apiKey || (envKey ? process.env[envKey] : undefined);

    switch (sdkType) {
        case "AZURE": {
            const effectiveResourceName = resourceName || process.env.AZURE_OPENAI_RESOURCE_NAME;
            const apiVersion = process.env.AZURE_OPENAI_API_VERSION || "2024-02-15-preview";

            if (!effectiveResourceName || !effectiveApiKey) {
                throw new Error(`Azure OpenAI configuration incomplete (resourceName: ${!!effectiveResourceName}, apiKey: ${!!effectiveApiKey}). Update your team AI config to use a configured provider.`);
            }

            const azure = createAzure({
                apiKey: effectiveApiKey,
                resourceName: effectiveResourceName,
                apiVersion: apiVersion,
            });
            return azure(modelId);
        }
        case "ANTHROPIC": {
            const anthropic = createAnthropic({
                apiKey: effectiveApiKey || process.env.ANTHROPIC_API_KEY,
                baseURL: effectiveBaseURL,
            });
            return anthropic(modelId);
        }
        case "GOOGLE": {
            const google = createGoogleGenerativeAI({
                apiKey: effectiveApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
                baseURL: effectiveBaseURL,
            });
            return google(modelId);
        }
        case "MISTRAL": {
            const mistral = createMistral({
                apiKey: effectiveApiKey || process.env.MISTRAL_API_KEY,
                baseURL: effectiveBaseURL,
            });
            return mistral(modelId);
        }
        case "BEDROCK": {
            const bedrock = createAmazonBedrock({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                region: process.env.AWS_REGION || "us-west-2",
            });
            return bedrock(modelId);
        }
        case "OPENAI_COMPATIBLE":
        case "CUSTOM":
        default: {
            const openai = createOpenAI({
                name: providerSlug.toLowerCase(),
                apiKey: effectiveApiKey || process.env.OPENAI_API_KEY,
                baseURL: effectiveBaseURL || builtInBaseUrls[providerSlug] || cleanUrl(process.env.OPENAI_BASE_URL),
            });
            return openai(modelId);
        }
    }
}


export interface AiModelResponse {
    model: any;
    provider: string;
    modelId: string;
    teamId: string | null;
}

 

export async function getAiSdkModel(
    target: { userId?: string; teamId?: string } | string | "system",
    service: AiService = "general",
    requiresVision: boolean = false
): Promise<AiModelResponse> {
    const DEBUG_PREFIX = `[getAiSdkModel][${service}]`;

    // LOCAL TEST BYPASS FOR PDF WIZARD (DB DOWN)
    if (service === "pdf_wizard") {
        const bedrock = require("@ai-sdk/amazon-bedrock").createAmazonBedrock({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || "us-west-2",
        });
        return {
            model: bedrock("moonshotai.kimi-k2.5"),
            provider: "BEDROCK",
            modelId: "moonshotai.kimi-k2.5",
            teamId: null
        };
    }

    // 1. Resolve teamId and userId
    let teamId: string | null = null;
    let userId: string | null = null;

    if (target === "system") {
        // System context
    } else if (typeof target === "string") {
        userId = target;
    } else {
        userId = target.userId || null;
        teamId = target.teamId || null;
    }

    if (userId && !teamId) {
        const user = await prismadb.users.findUnique({
            where: { id: userId },
            select: { team_id: true }
        });
        teamId = user?.team_id || null;
    }

    // 2. Load Hierarchy of Configs
    // Priority: Team Service Override > Team Default > System Service Override > System Default
    // ⚠️ PLAN GATING: Only SCALE, ENTERPRISE, and EXEMPT plans can use team-level AI configs.
    //    STARTER and GROWTH plans are forced to use the platform system config.

    let finalProvider: string | null = null;
    let finalModelId: string | null = null;
    let configSource: "team" | "system" = "system";

    // A. Check Team Config (only if plan tier allows custom AI config)
    let teamConfig = null;
    const PLANS_WITH_CUSTOM_AI = ["SCALE", "ENTERPRISE"];

    if (teamId) {
        // Resolve the team's subscription plan to determine if they can use custom AI config
        const teamRecord = await prismadb.team.findUnique({
            where: { id: teamId },
            select: { subscription_plan: true, team_type: true, parent_id: true }
        });

        // For departments, check parent's plan
        let effectivePlan = (teamRecord as any)?.subscription_plan || "STARTER";
        if ((teamRecord as any)?.team_type === "DEPARTMENT" && (teamRecord as any)?.parent_id) {
            const parentTeam = await prismadb.team.findUnique({
                where: { id: (teamRecord as any).parent_id },
                select: { subscription_plan: true }
            });
            effectivePlan = (parentTeam as any)?.subscription_plan || effectivePlan;
        }

        const canUseCustomAi = PLANS_WITH_CUSTOM_AI.includes(effectivePlan);

        if (canUseCustomAi) {
            teamConfig = await prismadb.teamAiConfig.findUnique({
                where: { team_id: teamId },
            });

            if (teamConfig) {
                // Check for service override in team configuration (JSON)
                const teamOverrides = (teamConfig.configuration as any)?.services || {};
                if (teamOverrides[service] && teamOverrides[service].modelId) {
                    finalProvider = teamOverrides[service].provider;
                    finalModelId = teamOverrides[service].modelId;
                    configSource = "team";
                } else if (teamConfig.provider && teamConfig.modelId) {
                    // Use team default if no service override
                    finalProvider = teamConfig.provider;
                    finalModelId = teamConfig.modelId;
                    configSource = "team";
                }
            }
        } else {
            console.debug(`${DEBUG_PREFIX} Team ${teamId} is on ${effectivePlan} plan — using platform system AI config (custom AI requires Scale+)`);
        }
    }

    // B. Check System Config (Fallback)
    const systemConfigs = await prismadb.systemAiConfig.findMany({ where: { isActive: true } });
    const defaultSystemConfig = systemConfigs.find((c: any) => c.isDefault) || systemConfigs[0];

    // B.1 Validate team provider actually has credentials configured at system level
    // If team points to a provider with no system config (e.g. stale AZURE reference), discard it
    if (finalProvider && configSource === "team") {
        const providerSysConfig = systemConfigs.find((c: any) => c.provider === finalProvider);
        const hasProviderConfigWithKey = providerSysConfig && providerSysConfig.apiKey && providerSysConfig.apiKey.trim().length > 0;
        const providerEnvKeys: Record<string, string[]> = {
            AZURE: ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_RESOURCE_NAME"],
            OPENAI: ["OPENAI_API_KEY"],
            BEDROCK: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
        };
        const requiredEnvs = providerEnvKeys[finalProvider] || [];
        const hasEnvCreds = requiredEnvs.length === 0 || requiredEnvs.every(k => !!process.env[k]);
        const teamHasOwnKey = teamConfig && !teamConfig.useSystemKey && !!teamConfig.apiKey;

        if (!hasProviderConfigWithKey && !hasEnvCreds && !teamHasOwnKey) {
            console.warn(`${DEBUG_PREFIX} Team config points to ${finalProvider} but no usable credentials found. Falling through to system default.`);
            finalProvider = null;
            finalModelId = null;
            configSource = "system";
        }
    }

    if (!finalProvider || !finalModelId) {
        // Check for service-specific override in system configuration JSON
        // This allows setting different models for "chat" vs "enrichment" (leadgen)
        // Format: configuration.services = { chat: { provider, modelId }, enrichment: { provider, modelId } }
        const systemOverrides = (defaultSystemConfig?.configuration as any)?.services || {};

        if (systemOverrides[service] && systemOverrides[service].modelId) {
            finalProvider = systemOverrides[service].provider;
            finalModelId = systemOverrides[service].modelId;
        } else if (service === "pdf_wizard") {
            finalProvider = "BEDROCK";
            finalModelId = "anthropic.claude-3-5-sonnet-20241022-v2:0";
        } else {
            finalProvider = defaultSystemConfig?.provider || "BEDROCK";
            // DB field is `defaultModelId` (not `modelId`) — check both for safety
            finalModelId = (defaultSystemConfig as any)?.defaultModelId
                || (defaultSystemConfig as any)?.modelId
                || process.env.AWS_AI_MODEL_ID
                || "qwen.qwen3-next-80b-a3b"; // Safe default — supports tool calling
        }
        configSource = "system";
    }

    // C. Multimodal Guarantee Intercept
    if (requiresVision && finalModelId) {
        // Models known to strictly reject vision or behave poorly with standard Bedrock image payloads
        const textOnlyModels = ["qwen", "mistral", "deepseek", "llama", "grok", "gpt-3.5"];
        const lowerId = finalModelId.toLowerCase();
        const isTextOnly = textOnlyModels.some(m => lowerId.includes(m)) && !lowerId.includes("vl") && !lowerId.includes("vision");
        
        if (isTextOnly) {
            console.warn(`${DEBUG_PREFIX} Model ${finalModelId} does not support vision payloads. Throwing strict error for UI alert.`);
            throw new Error(`VISION_UNSUPPORTED_MODEL:${finalModelId}`);
        }
    }

    // D. Legacy DB sanitization for Qwen3 Bedrock Models
    // Fixes team configs that saved the old incorrect identifier before the DB seed was fixed
    if (finalProvider === "BEDROCK" && finalModelId?.includes("qwen.qwen3-vl-235b-a22b-instruct-v1:0")) {
        finalModelId = finalModelId.replace("-instruct-v1:0", "");
    }

    // 3. Resolve API Keys and Connection Info
    let finalApiKey: string | undefined;
    let finalBaseURL: string | undefined;
    let finalResourceName: string | undefined;

    // Helper to extract resourceName and baseUrl from config JSON
    const extractResName = (c: unknown) => (c && typeof c === 'object' && 'resourceName' in c) ? (c as any).resourceName as string : undefined;
    const extractCfgBaseUrl = (c: unknown) => (c && typeof c === 'object' && 'baseUrl' in c && typeof (c as any).baseUrl === 'string') ? (c as any).baseUrl as string : undefined;

    // If we have a provider and model, find the system config for that provider to get keys/urls
    const providerSystemConfig = systemConfigs.find((c: any) => c.provider === finalProvider);

    if (teamConfig && configSource === "team" && !teamConfig.useSystemKey && teamConfig.apiKey) {
        // Team provided their own key
        finalApiKey = decryptSecret(teamConfig.apiKey) || undefined;
        finalBaseURL = extractCfgBaseUrl(teamConfig.configuration) || providerSystemConfig?.baseUrl || undefined;
        finalResourceName = extractResName(providerSystemConfig?.configuration);
    } else {
        // Use system key for this provider
        if (providerSystemConfig) {
            if (providerSystemConfig.apiKey) {
                finalApiKey = decryptSecret(providerSystemConfig.apiKey) || undefined;
            }
            finalBaseURL = providerSystemConfig.baseUrl || undefined;
            finalResourceName = extractResName(providerSystemConfig.configuration);
        }
    }

    // Sanitize 
    const cleanUrl = (url: string | undefined) => url?.endsWith('/') ? url.slice(0, -1) : url;
    finalBaseURL = cleanUrl(finalBaseURL);

    console.debug(`${DEBUG_PREFIX} Routing to: ${finalProvider}:${finalModelId} (Source: ${configSource}, Team: ${teamId || "SYSTEM"}, hasApiKey: ${!!finalApiKey}, hasBaseURL: ${!!finalBaseURL}, hasResourceName: ${!!finalResourceName})`);

    const model = await createProviderModel(finalProvider!, finalModelId!, finalApiKey, finalResourceName, finalBaseURL);

    return {
        model,
        provider: finalProvider!,
        modelId: finalModelId!,
        teamId
    };
}

/**
 * Logs AI usage to crm_AiUsageLog for billing and quota management.
 */
export async function logAiUsage({
    teamId,
    userId,
    service,
    model,
    usage,
    description
}: {
    teamId: string | null;
    userId: string | null;
    service: AiService;
    model: string;
    usage: { promptTokens: number; completionTokens: number };
    description?: string;
}) {
    if (!teamId) return;

    // LOCAL TEST BYPASS FOR PDF WIZARD
    if (service === "pdf_wizard") return;

    // Model-aware token pricing (base cost + 50% markup)
    // Format: [inputCostPer1M, outputCostPer1M] (base, before markup)
    const MODEL_PRICING: Record<string, [number, number]> = {
      'qwen3-next-80b':        [0.20,  1.80],   // Qwen3 Next 80B (normalized)
      'qwen3-coder-30b':       [0.20,  1.80],   // Qwen3 Coder 30B (normalized)
      'qwen3-235b':            [0.20,  1.80],   // Qwen3 235B (normalized)
      'qwen3-32b':             [0.20,  1.80],   // Qwen3 32B (normalized)
      'claude-haiku-4-5':      [1.00,  5.00],   // Claude Haiku 4.5
      'claude-3-5-haiku':      [1.00,  5.00],   // Claude 3.5 Haiku
      'claude-3-5-sonnet':     [3.00, 15.00],   // Claude 3.5 Sonnet
      'claude-sonnet-4':       [3.00, 15.00],   // Claude Sonnet 4
    };
    const DEFAULT_PRICING: [number, number] = [1.00, 5.00]; // Fallback (Haiku-level)
    const MARKUP = 1.5; // 50% markup

    const modelLower = model.toLowerCase();
    const pricingKey = Object.keys(MODEL_PRICING).find(k => modelLower.includes(k));
    const [baseInput, baseOutput] = pricingKey ? MODEL_PRICING[pricingKey] : DEFAULT_PRICING;
    const PRICE_PER_INPUT_TOKEN = (baseInput * MARKUP) / 1_000_000;
    const PRICE_PER_OUTPUT_TOKEN = (baseOutput * MARKUP) / 1_000_000;
    const cost =
      (usage.promptTokens * PRICE_PER_INPUT_TOKEN) +
      (usage.completionTokens * PRICE_PER_OUTPUT_TOKEN);

    try {
        await prismadb.crm_AiUsageLog.create({
            data: {
                tenant_id: teamId,
                user_id: userId || undefined,
                service,
                model_used: model,
                tokens_in: usage.promptTokens,
                tokens_out: usage.completionTokens,
                cost,
                description: description || `AI ${service} interaction`
            }
        });

        // Deduct from team's AI token balance
        const totalTokens = (usage.promptTokens || 0) + (usage.completionTokens || 0);
        if (totalTokens > 0) {
            await consumeAiTokens(teamId, totalTokens);
        }
    } catch (error: any) {
        // Re-throw insufficient token errors so callers can halt gracefully
        if (error?.message?.includes('Insufficient AI tokens')) {
            throw error;
        }
        console.error("[LOG_AI_USAGE_ERROR]", error);
    }
}
