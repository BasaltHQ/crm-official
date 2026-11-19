import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getAiClient } from "@/lib/ai-helper";
import { generateText } from "ai";
import { systemLogger } from "@/lib/logger";
import { logAiUsage } from "@/lib/varuni";
import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { safeFetch } from "@/lib/security/ssrf-guard";

export const maxDuration = 300;

// ─── Pre-extract visual brand signals from raw HTML before stripping ───
function extractVisualBrandSignals(html: string, baseUrl: string) {
    const signals: {
        logoUrls: string[];
        faviconUrls: string[];
        ogImages: string[];
        themeColors: string[];
        cssColors: string[];
        metaDescription: string;
        ogTitle: string;
        ogDescription: string;
    } = {
        logoUrls: [],
        faviconUrls: [],
        ogImages: [],
        themeColors: [],
        cssColors: [],
        metaDescription: "",
        ogTitle: "",
        ogDescription: "",
    };

    const resolveUrl = (src: string) => {
        if (!src) return "";
        if (src.startsWith("http")) return src;
        if (src.startsWith("//")) return `https:${src}`;
        if (src.startsWith("/")) {
            try {
                const u = new URL(baseUrl);
                return `${u.protocol}//${u.host}${src}`;
            } catch { return src; }
        }
        return src;
    };

    // 1. Logo candidates: <img> with "logo" in src, alt, class, or id
    const imgRegex = /<img\s[^>]*?(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
        const full = m[0].toLowerCase();
        const src = m[1];
        if (full.includes("logo") || full.includes("brand") || full.includes("header-img")) {
            signals.logoUrls.push(resolveUrl(src));
        }
    }

    // 2. OG image (excellent logo/brand image source)
    const ogImageMatch = html.match(/<meta\s[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta\s[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImageMatch) signals.ogImages.push(resolveUrl(ogImageMatch[1]));

    // 3. Favicon / apple-touch-icon
    const iconRegex = /<link\s[^>]*rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["']/gi;
    while ((m = iconRegex.exec(html)) !== null) {
        signals.faviconUrls.push(resolveUrl(m[1]));
    }

    // 4. Theme color from meta
    const themeColorMatch = html.match(/<meta\s[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta\s[^>]*content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
    if (themeColorMatch) signals.themeColors.push(themeColorMatch[1]);

    // 5. CSS: extract prominent hex/rgb colors from inline styles and <style> blocks
    const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const inlineStyles = html.match(/style=["']([^"']+)["']/gi) || [];
    const allCss = [...styleBlocks, ...inlineStyles].join(" ");

    // Hex colors
    const hexColors = allCss.match(/#[0-9a-fA-F]{6}\b/g) || [];
    // Filter out pure blacks, whites, and grays
    const meaningfulHex = hexColors.filter((c: string) => {
        const lower = c.toLowerCase();
        return lower !== "#000000" && lower !== "#ffffff" && lower !== "#333333"
            && lower !== "#666666" && lower !== "#999999" && lower !== "#cccccc"
            && lower !== "#f5f5f5" && lower !== "#eeeeee" && lower !== "#fafafa";
    });
    signals.cssColors = Array.from(new Set(meaningfulHex)).slice(0, 10);

    // CSS custom properties for brand colors
    const cssVarMatch = allCss.match(/--(?:primary|brand|accent|main)[^:]*:\s*([^;]+)/gi) || [];
    cssVarMatch.forEach((match: string) => {
        const val = match.split(":")[1]?.trim();
        if (val && (val.startsWith("#") || val.startsWith("rgb"))) {
            signals.themeColors.push(val);
        }
    });

    // 6. OG title and description
    const ogTitleMatch = html.match(/<meta\s[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta\s[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch) signals.ogTitle = ogTitleMatch[1];

    const ogDescMatch = html.match(/<meta\s[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta\s[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    if (ogDescMatch) signals.ogDescription = ogDescMatch[1];

    // 7. Meta description
    const metaDescMatch = html.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
        || html.match(/<meta\s[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (metaDescMatch) signals.metaDescription = metaDescMatch[1];

    return signals;
}

export async function POST(req: Request) {
    try {
        const { error, session, teamInfo } = await getSessionAndTeam();
        if (error || !session?.user || !teamInfo) {
            return error || new NextResponse("Unauthorized", { status: 401 });
        }

        const { url, teamId, preview } = await req.json();

        if (!url || !teamId) {
            return new NextResponse("URL and Team ID are required", { status: 400 });
        }

        if (!validateResourceOwnership(teamInfo.teamId, teamId, teamInfo.isPlatformAdmin)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        if (!preview && !teamInfo.isAdmin) {
            return new NextResponse("Forbidden: Admin access required", { status: 403 });
        }

        // Fetch website content via SSRF-safe fetcher
        const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
        let htmlText = "";
        try {
            const res = await safeFetch(normalizedUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                }
            });

            if (!res.ok) {
                return new NextResponse("Failed to fetch website", { status: 400 });
            }
            htmlText = await res.text();
        } catch (fetchErr) {
            systemLogger.error("[AI_SCRAPE_FETCH_ERROR]", fetchErr);
            return new NextResponse("Failed to connect to the provided URL.", { status: 400 });
        }

        // ─── PHASE 1: Extract visual brand signals from raw HTML ───
        const visualSignals = extractVisualBrandSignals(htmlText, normalizedUrl);

        systemLogger.info("[AI_SCRAPE] Visual signals extracted:", {
            logos: visualSignals.logoUrls.length,
            ogImages: visualSignals.ogImages.length,
            favicons: visualSignals.faviconUrls.length,
            themeColors: visualSignals.themeColors.length,
            cssColors: visualSignals.cssColors.length,
        });

        // ─── PHASE 2: Strip HTML for text-based AI extraction ───
        const bodyMatch = htmlText.match(/<body[^>]*>([\w|\W]*)<\/body>/im);
        const bodyContent = bodyMatch ? bodyMatch[1] : htmlText;

        const strictClean = bodyContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
            .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
            .replace(/<[^>]+>/ig, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const textContent = strictClean.substring(0, 20000);

        const { model } = await getAiClient(teamId);

        const visualContext = `
=== PRE-EXTRACTED VISUAL BRAND SIGNALS ===
Logo Image URLs found: ${[...visualSignals.logoUrls, ...visualSignals.ogImages].join(", ") || "None found"}
Favicon URLs: ${visualSignals.faviconUrls.join(", ") || "None found"}
Theme colors (meta/CSS vars): ${visualSignals.themeColors.join(", ") || "None found"}
Prominent CSS hex colors: ${visualSignals.cssColors.join(", ") || "None found"}
OG Title: ${visualSignals.ogTitle || "None"}
OG Description: ${visualSignals.ogDescription || "None"}
Meta Description: ${visualSignals.metaDescription || "None"}
=== END VISUAL SIGNALS ===
`;

        const systemMessage = `
You are a rigorous Brand Identity AI extractor for a CRM outreach platform (email, SMS, phone calls).
Given the raw text content from a company's website AND pre-extracted visual brand signals (logos, colors, metadata),
your job is to extract their complete Brand Identity.

Focus on information that would be useful for crafting personalized outreach emails, SMS messages, and phone call scripts.

CRITICAL INSTRUCTIONS:
- For "logo_url": Use the BEST logo URL from the pre-extracted signals. Prefer logo image URLs over OG images over favicons. Return the full absolute URL.
- For "primary_brand_color": Use the theme-color or the MOST PROMINENT non-gray CSS hex color from the signals. Return a hex value like "#0ea5e9".
- For "tagline": Extract the company's actual tagline, slogan, or elevator pitch. Look for text near the logo, h1 tags, or OG description. This should be a short, punchy phrase.
- If a value isn't obvious from the website content, make your best inferential guess based on context. NEVER leave fields empty — always provide a reasonable inference.

Return a JSON object with the following EXACT structure (no other text outside the JSON):
{
    "company_name": "String",
    "industry": "String",
    "location": "String (city, state/country)",
    "website_url": "String (the URL being scraped)",
    "phone_number": "String (if found, else empty)",
    "company_email": "String (if found, else empty)",
    "tagline": "String (their actual tagline/slogan, or a compelling one-liner synthesized from their messaging)",
    "logo_url": "String (absolute URL to their best logo image)",
    "primary_brand_color": "String (hex color like #0ea5e9)",
    "mission_statement": "String (synthesize from their about/mission page content)",
    "core_philosophy": "String",
    "core_values": ["Value 1", "Value 2", "Value 3"],
    "strategic_focus_areas": ["Focus 1", "Focus 2"],
    "competitive_advantages": ["Advantage 1", "Advantage 2"],
    "key_products_services": ["Product 1", "Service 1"],
    "pain_points_solved": ["Pain Point 1", "Pain Point 2"],
    "audience_description": "String (who are their customers? industries, roles, company sizes)",
    "business_model_summary": "String (how does the company generate revenue?)",
    "ideal_customer_profile": "String (who is the ideal buyer? job title, company size, industry)",
    "persona_preset": "PROFESSIONAL",
    "brand_voice": "String (e.g. Visionary, Authoritative, Approachable)",
    "agent_tone": "String (e.g. Efficient, Precise, Direct)",
    "communication_style": "String (e.g. Technical but Accessible, Conversational)",
    "outreach_approach": "String (how should outreach feel? e.g. Consultative, Value-led)",
    "messaging_themes": ["Theme 1", "Theme 2"],
    "cta_preferences": ["Book a Demo", "Start Free Trial"],
    "objection_handling": "String (common objections and suggested responses)",
    "do_not_say": ["Word or phrase to avoid"],
    "email_compliance_footer": "String (physical address if found, else company name + location)",
    "sms_opt_out_message": "Reply STOP to unsubscribe",
    "call_script_intro": "String (suggested phone introduction)",
    "follow_up_cadence": "String (suggested days between follow-ups)",
    "business_hours": "String (if found, else reasonable default like 9 AM - 5 PM)",
    "preferred_channel_priority": ["EMAIL", "SMS", "PHONE"],
    "grammar_accuracy": 80,
    "avoid_em_dashes": true,
    "emoji_frequency": 5,
    "emoji_allowed_in": ["posts"],
    "require_verified_account": false,
    "subsidiaries": ["Sub-brand 1", "Child Company"],
    "partner_categories": ["Partner Type 1", "Partner Type 2"]
}

ADDITIONAL FIELD INSTRUCTIONS:
- "grammar_accuracy": Integer 0-100. Infer from the website's writing style. Formal corporate sites → 90-100. Casual startups → 60-75. Default 80.
- "avoid_em_dashes": Boolean. Set true unless the brand's own copy heavily uses em dashes.
- "emoji_frequency": Integer 0-100. If the website uses emojis, set 20-40. If formal/corporate, set 0-5. Default 5.
- "emoji_allowed_in": Array of contexts. If the brand seems casual/social-media-forward, include ["posts", "replies"]. If corporate, just ["posts"] or empty.
- "require_verified_account": Boolean. Default false. Set true only if the brand explicitly focuses on enterprise/verified-only engagement.
- "subsidiaries": Array. Look for sub-brands, product lines, or child companies mentioned on the website.
- "partner_categories": Array. Look for partner/integration/ecosystem pages. Extract categories like "Payment Processors", "Cloud Providers", etc.
`;

        const { text, usage } = await generateText({
            model: model,
            system: systemMessage,
            prompt: `Website URL: ${url}\n\n${visualContext}\n\nWebsite text content:\n\n${textContent}`,
        });

        await logAiUsage({
            teamId, userId: session.user.id || null, service: "general",
            model: model.modelId || "brand-scraper",
            usage: { promptTokens: (usage as any)?.promptTokens || 0, completionTokens: (usage as any)?.completionTokens || 0 },
            description: `Brand scrape: ${url}`
        });

        const cleanJsonText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
        const brandData = JSON.parse(cleanJsonText);

        const brandIdentityData = {
            company_name: brandData.company_name || "",
            industry: brandData.industry || "",
            location: brandData.location || "",
            website_url: brandData.website_url || url,
            phone_number: brandData.phone_number || "",
            company_email: brandData.company_email || "",
            tagline: brandData.tagline || "",
            logo_url: brandData.logo_url || visualSignals.logoUrls[0] || visualSignals.ogImages[0] || "",
            primary_brand_color: brandData.primary_brand_color || visualSignals.themeColors[0] || visualSignals.cssColors[0] || "",
            mission_statement: brandData.mission_statement || "",
            core_philosophy: brandData.core_philosophy || "",
            core_values: brandData.core_values || [],
            strategic_focus_areas: brandData.strategic_focus_areas || [],
            competitive_advantages: brandData.competitive_advantages || [],
            key_products_services: brandData.key_products_services || [],
            pain_points_solved: brandData.pain_points_solved || [],
            audience_description: brandData.audience_description || "",
            business_model_summary: brandData.business_model_summary || "",
            ideal_customer_profile: brandData.ideal_customer_profile || "",
            persona_preset: brandData.persona_preset || "PROFESSIONAL",
            brand_voice: brandData.brand_voice || "",
            agent_tone: brandData.agent_tone || "",
            communication_style: brandData.communication_style || "",
            outreach_approach: brandData.outreach_approach || "",
            messaging_themes: brandData.messaging_themes || [],
            cta_preferences: brandData.cta_preferences || [],
            objection_handling: brandData.objection_handling || "",
            do_not_say: brandData.do_not_say || [],
            email_compliance_footer: brandData.email_compliance_footer || "",
            sms_opt_out_message: brandData.sms_opt_out_message || "Reply STOP to unsubscribe",
            call_script_intro: brandData.call_script_intro || "",
            follow_up_cadence: brandData.follow_up_cadence || "",
            business_hours: brandData.business_hours || "",
            preferred_channel_priority: brandData.preferred_channel_priority || ["EMAIL", "SMS", "PHONE"],
            grammar_accuracy: typeof brandData.grammar_accuracy === "number" ? brandData.grammar_accuracy : 80,
            avoid_em_dashes: typeof brandData.avoid_em_dashes === "boolean" ? brandData.avoid_em_dashes : true,
            emoji_frequency: typeof brandData.emoji_frequency === "number" ? brandData.emoji_frequency : 5,
            emoji_allowed_in: brandData.emoji_allowed_in || ["posts"],
            require_verified_account: typeof brandData.require_verified_account === "boolean" ? brandData.require_verified_account : false,
            subsidiaries: brandData.subsidiaries || [],
            partner_categories: brandData.partner_categories || [],
            setup_completed: true
        };

        // ─── PREVIEW MODE: return data + visual options for human review ───
        if (preview) {
            const allLogos = Array.from(new Set([
                ...(brandData.logo_url ? [brandData.logo_url] : []),
                ...visualSignals.logoUrls,
                ...visualSignals.ogImages,
                ...visualSignals.faviconUrls,
            ])).filter(Boolean);

            const allColors = Array.from(new Set([
                ...(brandData.primary_brand_color ? [brandData.primary_brand_color] : []),
                ...visualSignals.themeColors,
                ...visualSignals.cssColors,
            ])).filter(Boolean);

            return NextResponse.json({
                brandData: brandIdentityData,
                options: {
                    logos: allLogos,
                    colors: allColors,
                }
            });
        }

        // ─── COMMIT MODE: save directly to DB ───
        const existingBrand = await prismadb.teamBrandIdentity.findFirst({
            where: { team_id: teamId, is_default: true }
        });

        let updatedBrand;
        if (existingBrand) {
            updatedBrand = await prismadb.teamBrandIdentity.update({
                where: { id: existingBrand.id },
                data: { ...brandIdentityData },
            });
        } else {
            updatedBrand = await prismadb.teamBrandIdentity.create({
                data: { team_id: teamId, ...brandIdentityData }
            });
        }

        return NextResponse.json(updatedBrand);

    } catch (error) {
        systemLogger.error("[AI_SCRAPE_BRAND_ERROR]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
