/**
 * Agentic AI Lead Scraper - The World's Most Powerful
 * Uses GPT-5/GPT-4 with function calling to autonomously:
 * - Search for companies (Bing API)
 * - Visit and analyze websites
 * - Extract contacts intelligently
 * - Refine search strategy based on results
 */

import net from "net";
import { getAiSdkModel, isReasoningModel, logAiUsage } from "@/lib/varuni";
import { assertSafeExternalUrl, isPrivateOrReservedIp } from "@/lib/security/ssrf-guard";
import { z } from "zod";
import { generateObject, generateText, tool, type ModelMessage } from "ai";

import { prismadbCrm } from "@/lib/prisma-crm";
import { prismadb } from "@/lib/prisma";
import { consumeAiTokens } from "@/lib/ai-tokens";
import { checkTeamQuota } from "@/lib/quota-service";
// import { launchBrowser, newPageWithDefaults, closeBrowser } from "@/lib/scraper-browser";
import {
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  normalizeName,
  safeContactDisplayName,
  generateCompanyDedupeKey,
  generatePersonDedupeKey,
  calculateCompanyConfidence
} from "./normalize";
import { fixConcatenatedWords as fixConcat } from "./quality/text-concatenation";
import { shouldIgnoreEmail } from "./quality/email-filters";
import { normalizePhone as normalizePhoneDigits } from "./quality/phone-normalizer";
import { normalizeTechStack as canonTech } from "./quality/tech-normalizer";
import { detectTechFromSnapshot } from "./tech/detector";
import { sanitizeContact } from "./quality/contact-sanitizer";
import { decodeEmailCandidates } from "./quality/email-deobfuscate";
import { verifyEmail } from "./verify/email-verify";
import { buildResendAdapters } from "./verify/adapters/resend-adapters";
import { rankLinks } from "./ai/link-ranker";
import ScraperConfig from "./config";
import { learnDomainPatterns, guessEmailForName } from "./ml/pattern-model";
import { normalizeTitleAndPersona } from "./quality/title-normalizer";

type ICPConfig = {
  industries?: string[];
  companySizes?: string[];
  geos?: string[];
  techStack?: string[];
  titles?: string[];
  excludeDomains?: string[];
  notes?: string;
  limits?: {
    maxCompanies?: number;
    maxContactsPerCompany?: number;
  };
};

/**
 * Search companies using a multi-tier strategy:
 * 1. Puppeteer DuckDuckGo (primary — DDG doesn't block headless browsers)
 * 2. HTTP DuckDuckGo HTML (no browser needed — most reliable fallback)
 * 3. Puppeteer Google (last resort — with consent-page handling)
 */

const SEARCH_EXCLUDE_PATTERNS = [
  'wikipedia.org', 'youtube.com', 'facebook.com',
  'twitter.com', 'instagram.com', 'google.com',
  'reddit.com', 'medium.com', 'github.com',
  'pinterest.com', 'tiktok.com', 'snapchat.com',
  'bing.com', 'yahoo.com', 'quora.com',
  'linkedin.com', 'glassdoor.com', 'duckduckgo.com',
  'crunchbase.com', 'zoominfo.com', 'apollo.io',
  'pitchbook.com', 'yelp.com', 'bbb.org',
  'mapquest.com', 'capterra.com', 'g2.com',
  'apps.apple.com', 'play.google.com', 'substack.com',
];

function isExcludedDomain(hostname: string): boolean {
  return SEARCH_EXCLUDE_PATTERNS.some(p => hostname.includes(p));
}

function extractUrlDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch { return ''; }
}

type SerpResult = { name: string; url: string; snippet: string; domain: string };

/** Tier 1: Puppeteer DuckDuckGo — bot-friendly, most reliable */
async function ddgPuppeteerSearch(query: string, count: number): Promise<SerpResult[]> {
  let browser;
  try {
    const { launchBrowser: lb, newPageWithDefaults: np, closeBrowser: cb } = await import("@/lib/scraper-browser");
    browser = await lb();
    const page = await np(browser);

    // Human simulation: Direct navigation to /?q= gets blocked/rate-limited easily.
    // We must navigate to the home page, type naturally, and hit Enter
    let results: SerpResult[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.goto('https://duckduckgo.com/', { waitUntil: "domcontentloaded", timeout: 20000 });
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
        
        // Wait for the pristine DuckDuckGo search box and type the query organically
        await page.waitForSelector('input[name="q"], #search_form_input_homepage', { timeout: 8000 });
        await page.type('input[name="q"], #search_form_input_homepage', query, { delay: 35 });
        
        await Promise.all([
          page.keyboard.press('Enter'),
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {})
        ]);

        // Wait for results to render (DDG uses JS rendering)
        try {
          await page.waitForSelector('[data-result], .result, article[data-testid="result"]', { timeout: 8000 });
        } catch {
          // Results might already be there or use a different selector
        }
        await new Promise(resolve => setTimeout(resolve, 2000));

        results = await page.evaluate((maxCount: number) => {
      const items: Array<{ name: string; url: string; snippet: string; domain: string }> = [];
      const excludes = [
        'wikipedia.org', 'youtube.com', 'facebook.com', 'twitter.com',
        'instagram.com', 'google.com', 'reddit.com', 'medium.com',
        'github.com', 'bing.com', 'yahoo.com', 'linkedin.com', 'duckduckgo.com',
        'crunchbase.com', 'zoominfo.com', 'apollo.io', 'pitchbook.com',
        'yelp.com', 'bbb.org', 'mapquest.com', 'capterra.com', 'g2.com',
        'apps.apple.com', 'play.google.com', 'substack.com'
      ];
      const seen = new Set<string>();

      // DDG result selectors (multiple patterns for robustness)
      const resultContainers = document.querySelectorAll(
        '[data-result="web"], article[data-testid="result"], .result, .nrn-react-div li[data-layout="organic"]'
      );

      for (let i = 0; i < resultContainers.length && items.length < maxCount; i++) {
        const container = resultContainers[i];
        // Find the main link
        const link = container.querySelector('a[href^="http"]') as HTMLAnchorElement | null;
        if (!link) continue;

        const href = link.href;
        if (!href || seen.has(href)) continue;

        try {
          const u = new URL(href);
          const hostname = u.hostname.replace(/^www\./i, '');
          if (excludes.some(p => hostname.includes(p))) continue;
          if (hostname.includes('duckduckgo.com')) continue;

          seen.add(href);

          // Title: look for heading or the link text itself
          const heading = container.querySelector('h2, h3, [data-testid="result-title-a"]');
          const name = (heading?.textContent?.trim() || link.textContent?.trim() || '').slice(0, 120);
          if (!name) continue;

          // Snippet: look for description text
          const snippetEl = container.querySelector(
            '[data-result="snippet"], .result__snippet, [data-testid="result-snippet"], span.kY2IgmnCmOGjharHErah'
          );
          const snippet = (snippetEl?.textContent?.trim() || '').slice(0, 200);

          items.push({ name, url: href, snippet, domain: hostname });
        } catch { continue; }
      }

      // Fallback: if no results found via containers, try all links with reasonable text
      if (items.length === 0) {
        const allLinks = document.querySelectorAll('a[href^="http"]');
        for (let i = 0; i < allLinks.length && items.length < maxCount; i++) {
          const a = allLinks[i] as HTMLAnchorElement;
          const href = a.href;
          if (!href || seen.has(href)) continue;
          try {
            const u = new URL(href);
            const hostname = u.hostname.replace(/^www\./i, '');
            if (excludes.some(p => hostname.includes(p))) continue;
            if (hostname.includes('duckduckgo.com')) continue;
            const text = a.textContent?.trim() || '';
            if (text.length < 5 || text.length > 200) continue;
            seen.add(href);
            items.push({ name: text.slice(0, 120), url: href, snippet: '', domain: hostname });
          } catch { continue; }
        }
      }

      return items;
    }, count);

    if (results.length > 0) {
      console.log(`[DDG/Puppeteer] "${query}" -> ${results.length} results`);
      return results;
    }

  } catch (err) {
    console.warn(`[DDG/Puppeteer] Attempt ${attempt} failed:`, err);
  }
}

return [];
  } catch (error) {
    console.error("[DDG/Puppeteer] Search error:", error);
    return [];
  } finally {
    if (browser) {
      const { closeBrowser: cb } = await import("@/lib/scraper-browser");
      await cb(browser);
    }
  }
}

/** Tier 3: Puppeteer Google (Stealth) — powerful but volatile */
async function googlePuppeteerSearch(query: string, count: number): Promise<SerpResult[]> {
  let browser;
  try {
    const { launchBrowser: lb, newPageWithDefaults: np, closeBrowser: cb } = await import("@/lib/scraper-browser");
    browser = await lb();
    const page = await np(browser);

    // Human simulation: Navigation to direct /search?q= gets CAPTCHAs instantly.
    // We must navigate to the home page, type naturally, and hit Enter
    let results: SerpResult[] = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await page.goto('https://www.google.com/', { waitUntil: "domcontentloaded", timeout: 20000 });
        await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 500));
        
        // Wait for the pristine Google search box and type the query organically
        await page.waitForSelector('textarea[name="q"]', { timeout: 8000 });
        await page.type('textarea[name="q"]', query, { delay: 35 });
        
        await Promise.all([
          page.keyboard.press('Enter'),
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 })
        ]);
        
        // Wait for results
        await page.waitForSelector('.g, #search, [data-sokoban-container]', { timeout: 8000 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        results = await page.evaluate((maxCount: number) => {
          const items: Array<{ name: string; url: string; snippet: string; domain: string }> = [];
          const excludes = [
            'wikipedia.org', 'youtube.com', 'facebook.com', 'twitter.com',
            'instagram.com', 'google.com', 'reddit.com', 'medium.com',
            'github.com', 'bing.com', 'yahoo.com', 'linkedin.com', 'duckduckgo.com',
            'crunchbase.com', 'zoominfo.com', 'apollo.io', 'pitchbook.com',
            'yelp.com', 'bbb.org', 'mapquest.com', 'capterra.com', 'g2.com',
            'apps.apple.com', 'play.google.com', 'substack.com'
          ];
          const seen = new Set<string>();

          // Google standard organic results '.g'
          const resultContainers = document.querySelectorAll('.g');

          for (let i = 0; i < resultContainers.length && items.length < maxCount; i++) {
            const container = resultContainers[i];
            const link = container.querySelector('a[href^="http"]') as HTMLAnchorElement | null;
            if (!link) continue;

            const href = link.href;
            if (!href || seen.has(href)) continue;

            try {
              const u = new URL(href);
              const hostname = u.hostname.replace(/^www\./i, '');
              if (excludes.some(p => hostname.includes(p))) continue;
              // Ignore generic google redirects which happen occasionally
              if (hostname.includes('google.com')) continue;

              seen.add(href);

              const heading = container.querySelector('h3');
              const name = (heading?.textContent?.trim() || link.textContent?.trim() || '').slice(0, 120);
              if (!name) continue;

              // Snippet usually wrapped in this class
              const snippetEl = container.querySelector('.VwiC3b, .UroOpe');
              const snippet = (snippetEl?.textContent?.trim() || '').slice(0, 200);

              items.push({ name, url: href, snippet, domain: hostname });
            } catch { continue; }
          }
          return items;
        }, count);

        // Break early if we found successful extraction
        if (results.length > 0) {
          console.log(`[Google/Stealth] Attempt ${attempt}: "${query}" -> ${results.length} results`);
          break;
        } else {
          console.log(`[Google/Stealth] Attempt ${attempt}: 0 results found, potentially blocked.`);
        }
      } catch (e) {
        console.warn(`[Google/Stealth] Attempt ${attempt} failed: ${(e as Error).message}`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    return results;
  } catch (error) {
    console.error("[Google/Stealth] Search error:", error);
    return [];
  } finally {
    if (browser) {
      const { closeBrowser: cb } = await import("@/lib/scraper-browser");
      await cb(browser);
    }
  }
}

/** Tier 2: HTTP DuckDuckGo HTML — no browser, fast, reliable */
async function ddgHttpSearch(query: string, count: number): Promise<SerpResult[]> {
  try {
    const response = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
      body: `q=${encodeURIComponent(query)}&b=`,
    });

    if (!response.ok) {
      console.error(`[DDG/HTTP] HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const results: SerpResult[] = [];
    const seen = new Set<string>();

    // Parse DDG HTML results — each result has class "result" with .result__a (title link) and .result__snippet
    // Match result links: <a class="result__a" href="...">Title</a>
    const linkRegex = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;

    const links: Array<{ url: string; title: string }> = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < count + 10) {
      let url = linkMatch[1];
      const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
      // DDG wraps URLs in a redirect — extract the actual URL
      if (url.includes('uddg=')) {
        try {
          const decoded = new URL(url, 'https://duckduckgo.com');
          url = decoded.searchParams.get('uddg') || url;
        } catch { /* keep original */ }
      }
      if (url.startsWith('http')) {
        links.push({ url, title });
      }
    }

    const snippets: string[] = [];
    let snippetMatch;
    while ((snippetMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(snippetMatch[1].replace(/<[^>]*>/g, '').trim());
    }

    for (let i = 0; i < links.length && results.length < count; i++) {
      const { url, title } = links[i];
      if (seen.has(url)) continue;
      const hostname = extractUrlDomain(url);
      if (!hostname || isExcludedDomain(hostname)) continue;
      seen.add(url);
      results.push({
        name: title.slice(0, 120),
        url,
        snippet: (snippets[i] || '').slice(0, 200),
        domain: hostname,
      });
    }

    console.log(`[DDG/HTTP] "${query}" -> ${results.length} results`);
    return results;
  } catch (error) {
    console.error("[DDG/HTTP] Search error:", error);
    return [];
  }
}



async function ddgWebSearch(query: string, count: number = 20, jobId?: string): Promise<SerpResult[]> {
  // Tier 1: Puppeteer DuckDuckGo (bot-friendly, JS-rendered results)
  const ddgResults = await ddgPuppeteerSearch(query, count);
  if (ddgResults.length > 0) return ddgResults;

  // Tier 2: HTTP DuckDuckGo HTML (no browser, fast, reliable)
  const httpResults = await ddgHttpSearch(query, count);
  if (httpResults.length > 0) return httpResults;

  // No results from either DDG method
  console.warn(`[SERP] DDG returned 0 results for: "${query}"`);
  return [];
}

/** Strip HTML tags from a string */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

// Heuristic fixer to insert spaces in concatenated words like "Contactme" -> "Contact me"
function fixConcatenatedWords(input: string | null | undefined): string {
  if (!input) return "";
  let s = String(input).trim();
  // Insert space between lower->Upper boundaries (camel-case like)
  s = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Insert space before some common lowercase suffixes stuck to the previous token
  const suffixes = ['me', 'us', 'now', 'team', 'about', 'info', 'support', 'contact'];
  for (const suf of suffixes) {
    const re = new RegExp(`(^|[^A-Za-z])([A-Za-z]{3,})${suf}$`, 'i');
    s = s.replace(re, (_m, p1, p2) => `${p1}${p2} ${suf}`);
  }
  // Collapse extra whitespace
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

// Tool parameter schemas defined with Zod for cross-provider compatibility
const searchCompaniesSchema = z.object({
  query: z.string().describe("The search query to find companies (e.g., 'SaaS companies in San Francisco')"),
  count: z.number().optional().describe("Number of results to return (1-50), defaults to 20"),
});

const exploreWebsiteSchema = z.object({
  url: z.string().describe("The root URL or sublink to visit and scan for structure"),
});

const readComponentSchema = z.object({
  url: z.string().describe("The URL of the page this component belongs to (must have been scanned first)"),
  component_id: z.string().describe("The specific structural ID or tag to read (e.g. 'footer', 'header', 'main', '.contact-info')"),
});

const analyzeCompanyFitSchema = z.object({
  domain: z.string().describe("Company domain"),
  companyData: z.any().optional().describe("Company information extracted from website"),
});

const saveCompanySchema = z.object({
  domain: z.string().describe("Company domain"),
  companyName: z.string().describe("Company name"),
  description: z.string().describe("Company description"),
  industry: z.string().describe("Primary industry"),
  techStack: z.array(z.string()).optional().describe("Detected technologies"),
  contacts: z.array(z.object({
    name: z.string().optional().describe("The REAL human name of the person (e.g., 'John Smith'). IMPORTANT: NEVER put button text, call-to-actions, or role names here. If you don't know the exact human name, DO NOT guess — just omit it or put an empty string."),
    title: z.string().optional().describe("Job title if known (e.g. 'CEO', 'VP Sales'). Omit or empty string for generic contacts."),
    email: z.string().optional().describe("Email address — include role/generic emails (info@, contact@, sales@) if a real personal email is not available."),
    phone: z.string().optional().describe("Phone number. Include if found even if no email is available."),
    linkedin: z.string().optional().describe("LinkedIn profile URL"),
  })).optional().describe("Include ALL contacts found. If you only found a generic email without a named person, include it. If you only found a phone, include it. Pass ALL partial contacts you find."),
});

const refineSearchStrategySchema = z.object({
  currentResults: z.number().describe("Number of qualified companies found so far"),
  targetResults: z.number().describe("Target number of companies"),
  reasoning: z.string().describe("Why the strategy should or shouldn't change"),
});

/**
 * Build tools definition for AI SDK
 * Using tool() helper with Zod schemas for cross-provider compatibility
 * Per AI SDK v5 docs: use `inputSchema` property with Zod schemas
 * Tool execution happens in executeToolCall() - not inline
 */
function buildToolsDefinition(context: { jobId: string; poolId: string; icp: ICPConfig; userId: string; logs: any[] }) {
  return {
    search_companies: tool({
      description: "Search for companies using DuckDuckGo Search. Returns company websites matching the query.",
      inputSchema: searchCompaniesSchema,
      async execute(input) {
        return await executeToolCall("search_companies", input, context);
      },
    }),
    explore_website_structure: tool({
      description: "Visit a URL and scan its structural layout (Header, Footer, Main Content) and sublinks. Returns a skeleton map of the page. Use this first to decide where to look for contacts.",
      inputSchema: exploreWebsiteSchema,
      async execute(input) {
        return await executeToolCall("explore_website_structure", input, context);
      },
    }),
    read_html_component: tool({
      description: "Reads the extracted text/HTML payload from a specific structural element parsed during the explore phase. Only use this on components returned by explore_website_structure.",
      inputSchema: readComponentSchema,
      async execute(input) {
        return await executeToolCall("read_html_component", input, context);
      },
    }),
    analyze_company_fit: tool({
      description: "Analyze if a company matches the ICP criteria and should be added to the pool.",
      inputSchema: analyzeCompanyFitSchema,
      async execute(input) {
        return await executeToolCall("analyze_company_fit", input, context);
      },
    }),
    save_company: tool({
      description: "Save a qualified company to the lead pool with extracted data.",
      inputSchema: saveCompanySchema,
      async execute(input) {
        return await executeToolCall("save_company", input, context);
      },
    }),
    refine_search_strategy: tool({
      description: "Based on results so far, decide if search strategy should be adjusted.",
      inputSchema: refineSearchStrategySchema,
      async execute(input) {
        return await executeToolCall("refine_search_strategy", input, context);
      },
    }),
  };
}

async function installScraperSsrfGuard(page: any) {
  try {
    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      const reqUrl = req.url();
      if (reqUrl.startsWith("data:") || reqUrl.startsWith("blob:")) {
        req.continue();
        return;
      }
      try {
        const parsed = new URL(reqUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          req.abort();
          return;
        }
        const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
        if (
          host === "localhost" ||
          host.endsWith(".localhost") ||
          host.endsWith(".local") ||
          host.endsWith(".internal") ||
          host === "metadata.google.internal" ||
          (net.isIP(host) && isPrivateOrReservedIp(host))
        ) {
          req.abort();
          return;
        }
        req.continue();
      } catch {
        req.abort();
      }
    });
  } catch {
    // Request interception may already be enabled on reused page
  }
}

/**
 * Discover sitemap URLs from a domain
 */
async function discoverSitemap(domain: string, page: any): Promise<string[]> {
  const sitemapUrls: string[] = [];
  const baseUrl = `https://${domain}`;

  try {
    await assertSafeExternalUrl(baseUrl);
    await installScraperSsrfGuard(page);

    // Try common sitemap locations
    const sitemapLocations = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemap/sitemap.xml`,
    ];

    // First check robots.txt for sitemap references
    try {
      await page.goto(`${baseUrl}/robots.txt`, { waitUntil: "domcontentloaded", timeout: 10000 });
      const robotsContent = await page.content();
      const sitemapMatches = robotsContent.match(/Sitemap:\s*(https?:\/\/[^\s]+)/gi);
      if (sitemapMatches) {
        sitemapMatches.forEach((match: string) => {
          const url = match.replace(/Sitemap:\s*/i, '').trim();
          if (!sitemapLocations.includes(url)) {
            sitemapLocations.unshift(url); // Add to front as priority
          }
        });
      }
    } catch (e) {
      // robots.txt not found, continue
    }

    // Try to fetch sitemap
    for (const sitemapUrl of sitemapLocations) {
      try {
        await assertSafeExternalUrl(sitemapUrl);
        await page.goto(sitemapUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
        const content = await page.content();

        // Parse XML sitemap
        const locMatches = content.match(/<loc>([^<]+)<\/loc>/gi);
        if (locMatches && locMatches.length > 0) {
          locMatches.forEach((match: string) => {
            const url = match.replace(/<\/?loc>/gi, '').trim();
            if (url.startsWith('http') && !url.endsWith('.xml')) {
              sitemapUrls.push(url);
            }
          });
          break; // Found valid sitemap
        }
      } catch (e) {
        // Sitemap not found at this location
      }
    }
  } catch (e) {
    console.log(`Sitemap discovery failed for ${domain}:`, e);
  }

  return sitemapUrls.slice(0, 100); // Limit to 100 URLs
}

/**
 * Get high-value internal page URLs using heuristics
 */
function getHighValuePageUrls(domain: string, sitemapUrls: string[]): string[] {
  const baseUrl = `https://${domain}`;
  const highValuePaths = [
    '/about', '/about-us', '/aboutus', '/about/',
    '/team', '/our-team', '/leadership', '/people', '/staff',
    '/contact', '/contact-us', '/contactus', '/contact/',
    '/careers', '/jobs', '/join-us', '/work-with-us',
    '/company', '/company/about', '/company/team',
  ];

  const urls: string[] = [];

  // Add high-value paths from heuristics
  for (const path of highValuePaths) {
    urls.push(`${baseUrl}${path}`);
  }

  // Add relevant URLs from sitemap
  if (sitemapUrls.length > 0) {
    const relevantSitemapUrls = sitemapUrls.filter(url => {
      const lowerUrl = url.toLowerCase();
      return (
        lowerUrl.includes('/about') ||
        lowerUrl.includes('/team') ||
        lowerUrl.includes('/contact') ||
        lowerUrl.includes('/careers') ||
        lowerUrl.includes('/leadership') ||
        lowerUrl.includes('/people') ||
        lowerUrl.includes('/staff') ||
        lowerUrl.includes('/company')
      );
    });
    urls.push(...relevantSitemapUrls);
  }

  // Deduplicate
  return Array.from(new Set(urls));
}

/**
 * Dismiss common overlays, cookie banners, and popups
 */
async function dismissOverlays(page: any): Promise<void> {
  try {
    await page.evaluate(() => {
      // Common cookie/consent selectors
      const dismissSelectors = [
        '[class*="cookie"] button',
        '[class*="consent"] button',
        '[class*="popup"] button[class*="close"]',
        '[class*="modal"] button[class*="close"]',
        '[class*="overlay"] button[class*="close"]',
        '[aria-label*="close"]',
        '[aria-label*="dismiss"]',
        '[aria-label*="accept"]',
        'button[class*="accept"]',
        'button[class*="agree"]',
        '#onetrust-accept-btn-handler',
        '.cc-btn.cc-dismiss',
        '.gdpr-accept',
        '.cookie-accept',
        // Age-check / age-gate selectors
        '[class*="age-gate"] button',
        '[class*="agegate"] button',
        '[class*="age-verify"] button',
        '[class*="age-verification"] button',
        '[class*="age-check"] button',
        '[class*="age_check"] button',
        '[id*="age-gate"] button',
        '[id*="agegate"] button',
        '[id*="age-verify"] button',
        '[id*="age-verification"] button',
        'button[class*="age-confirm"]',
        'button[class*="enter-site"]',
        'button[class*="age-yes"]',
        'a[class*="enter-site"]',
        'a[class*="age-confirm"]',
      ];

      for (const selector of dismissSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el: any) => {
            if (el && typeof el.click === 'function') {
              el.click();
            }
          });
        } catch (e) {
          // Ignore errors
        }
      }

      // Text-based age-gate bypass: click buttons/anchors whose text matches age-confirm patterns
      const ageGateTextPatterns = [
        /^yes$/i, /^enter$/i, /^i am (over |of legal |)?(18|19|21)\+?/i,
        /^i('m| am) (18|19|21)\s*(or older|\+|years)/i,
        /^(yes,? )?i am of (legal )?age/i, /^confirm age/i,
        /^i('m| am) old enough/i, /^verify( my)? age/i,
        /^enter site$/i, /^continue$/i,
      ];
      try {
        const allClickables = document.querySelectorAll('button, a[href], input[type="submit"], input[type="button"]');
        for (const el of Array.from(allClickables)) {
          const text = ((el as HTMLElement).textContent || (el as HTMLInputElement).value || '').trim();
          if (text.length > 0 && text.length < 60 && ageGateTextPatterns.some(p => p.test(text))) {
            (el as HTMLElement).click();
            break; // Only click the first match
          }
        }
      } catch (e) { /* ignore */ }

      // Remove overlay elements that might block content
      const overlaySelectors = [
        '[class*="cookie-banner"]',
        '[class*="cookie-notice"]',
        '[class*="gdpr"]',
        '[id*="cookie"]',
        '[class*="overlay"][style*="fixed"]',
        // Age-gate overlays
        '[class*="age-gate"]',
        '[class*="agegate"]',
        '[class*="age-verify"]',
        '[class*="age-verification"]',
        '[class*="age-check"]',
        '[id*="age-gate"]',
        '[id*="agegate"]',
        '[id*="age-verify"]',
      ];

      for (const selector of overlaySelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach((el: any) => {
            if (el && el.parentNode) {
              el.parentNode.removeChild(el);
            }
          });
        } catch (e) {
          // Ignore errors
        }
      }
    });
  } catch (e) {
    // Overlay dismissal failed, continue anyway
  }
}

/**
 * Extract page data (emails, phones, social links, tech stack)
 */
async function extractPageData(page: any): Promise<{
  title: string;
  description: string;
  emails: string[];
  phones: string[];
  socialLinks: { [key: string]: string };
  techStack: string[];
  internalLinks: string[];
  hrefList: string[];
  rawTextExcerpt: string;
  _techSnapshot?: { html?: string; scripts?: string[]; links?: string[] };
}> {
  return page.evaluate(() => {
    const result: any = {
      title: document.title,
      description: "",
      emails: [],
      phones: [],
      socialLinks: {},
      techStack: [],
      internalLinks: [],
      hrefList: [],
      rawTextExcerpt: ""
    };

    // Meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) result.description = metaDesc.getAttribute('content') || "";

    // Extract all emails - check both text and mailto links
    const emailPattern = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
    const bodyText = document.body.textContent || '';
    const emailMatches: string[] = [];
    const bodyEmailMatches = bodyText.match(emailPattern);
    if (bodyEmailMatches) {
      for (const e of bodyEmailMatches) {
        emailMatches.push(e);
      }
    }

    // Also get emails from mailto links
    const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
    mailtoLinks.forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      const email = href.replace('mailto:', '').split('?')[0];
      if (email && email.includes('@')) {
        emailMatches.push(email);
      }
    });

    // Filter out common non-person emails
    const filteredEmails = Array.from(new Set(emailMatches)).filter(email => {
      const lower = email.toLowerCase();
      // Keep info@, contact@, sales@ etc but filter obvious junk
      return !lower.includes('example.com') &&
        !lower.includes('domain.com') &&
        !lower.includes('email.com') &&
        !lower.includes('@sentry') &&
        !lower.includes('@wix') &&
        !lower.includes('@squarespace') &&
        !lower.endsWith('.png') &&
        !lower.endsWith('.jpg');
    });
    result.emails = filteredEmails.slice(0, 20);

    // Extract phones - more comprehensive patterns
    const phonePatterns = [
      /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
      /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g,
    ];
    const allPhones: string[] = [];
    for (const pattern of phonePatterns) {
      const matches = bodyText.match(pattern);
      if (matches) {
        for (const m of matches) {
          allPhones.push(m);
        }
      }
    }
    result.phones = Array.from(new Set(allPhones)).slice(0, 10);

    // Scripts and link hrefs for detector
    const scripts = Array.from(document.querySelectorAll('script[src]')).map((s) => (s as HTMLScriptElement).src || '');
    const links = Array.from(document.querySelectorAll('link[href]')).map((l) => (l as HTMLLinkElement).href || '');
    // Basic inline tech hints for fallback
    const html = document.documentElement.outerHTML.toLowerCase();

    // Detector will run outside the browser context for flexibility


    // Social links - expanded
    const socialPatterns = [
      { name: 'linkedin', pattern: /linkedin\.com/i },
      { name: 'twitter', pattern: /twitter\.com|x\.com/i },
      { name: 'facebook', pattern: /facebook\.com/i },
      { name: 'instagram', pattern: /instagram\.com/i },
      { name: 'youtube', pattern: /youtube\.com/i },
      { name: 'github', pattern: /github\.com/i },
    ];

    document.querySelectorAll('a[href]').forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      for (const social of socialPatterns) {
        if (social.pattern.test(href) && !result.socialLinks[social.name]) {
          result.socialLinks[social.name] = href;
        }
      }
    });

    // Internal links for potential deep crawling
    const currentHost = window.location.hostname;
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      try {
        const linkUrl = new URL(href);
        if (linkUrl.hostname === currentHost &&
          !href.includes('#') &&
          !href.match(/\.(pdf|jpg|png|gif|css|js)$/i)) {
          result.internalLinks.push(href);
        }
      } catch (e) {
        // Invalid URL
      }
    });
    result.internalLinks = Array.from(new Set(result.internalLinks)).slice(0, 50);
    // Capture href list and a large text excerpt for deobfuscation outside the browser
    result.hrefList = Array.from(document.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href);
    result.rawTextExcerpt = (document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50000);

    return {
      ...result,
      // Pass raw HTML for detector outside, plus scripts/links
      _techSnapshot: {
        html: document.documentElement.outerHTML,
        scripts,
        links,
      }
    };
  });
}

/**
 * Visit website using Puppeteer (real browser) to extract company data
 * Visits homepage + high-value subpages (/about, /contact, /team)
 */
import { launchBrowser, newPageWithDefaults, closeBrowser } from "@/lib/scraper-browser";

export async function visitWebsiteForAgent(url: string, userId?: string, icp?: ICPConfig, poolId?: string): Promise<any> {
  const db: any = prismadbCrm;
  const domain = normalizeDomain(url);
  const cacheThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000); // 14 days

  // 1. Try Cache First
  if (domain) {
    try {
      const cached = await db.crm_Global_Companies.findUnique({
        where: { domain },
        select: {
          companyName: true,
          description: true,
          industry: true,
          techStack: true,
          emails: true,
          phones: true,
          socialLinks: true,
          enrichmentData: true,
          lastSeen: true
        }
      });

      if (cached && cached.lastSeen && cached.lastSeen > cacheThreshold) {
        // Only serve cache if domain already exists in the CURRENT pool.
        // If the pool was deleted and re-created, the domain won't be in the new pool yet — bypass cache.
        let inCurrentPool = true;
        if (poolId) {
          const existingCandidate = await db.crm_Lead_Candidates.findFirst({
            where: { pool: poolId, domain },
            select: { id: true },
          });
          inCurrentPool = !!existingCandidate;
        }

        if (inCurrentPool) {
          console.log(`[CACHE_HIT] Using cached data for domain: ${domain}`);
          return {
            title: cached.companyName || "",
            description: cached.description || "",
            emails: cached.emails || [],
            phones: cached.phones || [],
            socialLinks: cached.socialLinks || {},
            techStack: cached.techStack || [],
            pagesVisited: [url],
            errors: [],
            fromCache: true
          };
        } else {
          console.log(`[CACHE_BYPASS] Domain ${domain} not in current pool ${poolId} — re-scraping`);
        }
      }
    } catch (cacheErr) {
      console.error("[CACHE_ERROR] Failed to read from global cache:", cacheErr);
    }
  }

  const targetUrl = url.startsWith("http") ? url : `https://${url}`;
  try {
    await assertSafeExternalUrl(targetUrl);
  } catch (ssrfErr: any) {
    return {
      title: "",
      description: "",
      contacts: [],
      emails: [],
      phones: [],
      socialLinks: {},
      techStack: [],
      pagesVisited: [],
      errors: [ssrfErr?.message || "Blocked unsafe target URL"],
      error: ssrfErr?.message || "Blocked unsafe target URL",
    };
  }

  // 2. Visit with Puppeteer (real browser)
  let browser;
  try {
    browser = await launchBrowser();
    const page = await newPageWithDefaults(browser);
    await installScraperSsrfGuard(page);

    const allEmails = new Set<string>();
    const allPhones = new Set<string>();
    const socialLinks: Record<string, string> = {};
    const pagesVisited: string[] = [];
    const allContacts: Array<{ name: string; title: string; email: string; phone: string; linkedin: string }> = [];
    const allLinkedinProfiles: string[] = [];
    let title = "";
    let description = "";
    const errors: string[] = [];

    /**
     * Extract structured data from the current page's rendered DOM
     * Enhanced: extracts structured contacts, LinkedIn profiles, and team members
     */
    const extractPageData = async () => {
      return await page.evaluate(() => {
        const text = document.body?.innerText || "";

        // Title
        const pageTitle = document.title || "";

        // Meta description
        const metaDesc = (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content || "";

        // ─── Structured Contact Extraction ───
        const contacts: Array<{ name: string; title: string; email: string; phone: string; linkedin: string }> = [];
        const seenEmails = new Set<string>();

        // 1. Mailto links with context: find email + nearby name/title
        document.querySelectorAll('a[href^="mailto:"]').forEach(a => {
          const email = (a as HTMLAnchorElement).href.replace("mailto:", "").split("?")[0].toLowerCase();
          if (!email || seenEmails.has(email)) return;
          if (email.endsWith(".png") || email.endsWith(".jpg") || email.includes("example.com")) return;
          seenEmails.add(email);

          // Look for context around the mailto link
          let name = "";
          let title = "";
          const parent = a.closest("li, div, p, td, article, section, figure, .team-member, [class*='card'], [class*='person'], [class*='member']");
          if (parent) {
            // Look for name in headings or strong/bold near the email
            const heading = parent.querySelector("h1, h2, h3, h4, h5, strong, b, [class*='name']");
            if (heading) {
              const candidateName = (heading as HTMLElement).innerText?.trim();
              if (candidateName && candidateName.length > 2 && candidateName.length < 60 && candidateName.split(" ").length >= 2) {
                name = candidateName;
              }
            }
            // Look for title in smaller text elements
            const titleEl = parent.querySelector("[class*='title'], [class*='role'], [class*='position'], small, .subtitle, em");
            if (titleEl) {
              const candidateTitle = (titleEl as HTMLElement).innerText?.trim();
              if (candidateTitle && candidateTitle.length > 2 && candidateTitle.length < 80) {
                title = candidateTitle;
              }
            }
          }

          contacts.push({ name, title, email, phone: "", linkedin: "" });
        });

        // 2. Text emails (not already found via mailto)
        const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
        const textEmails = text.match(emailRegex) || [];
        for (const email of textEmails) {
          const lower = email.toLowerCase();
          if (seenEmails.has(lower)) continue;
          if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".gif") ||
            lower.includes("example.com") || lower.includes("sentry") || lower.includes("webpack")) continue;
          seenEmails.add(lower);
          contacts.push({ name: "", title: "", email: lower, phone: "", linkedin: "" });
        }

        // 3. Team member cards / people sections
        const teamSelectors = [
          '.team-member', '.staff-member', '[class*="team"] [class*="card"]',
          '[class*="person"]', '[class*="member"]', '[class*="leadership"]',
          '[class*="staff"]', '.bio', '[class*="executive"]',
          'figure', '[class*="card"]',
        ];
        for (const sel of teamSelectors) {
          try {
            document.querySelectorAll(sel).forEach(card => {
              const cardText = (card as HTMLElement).innerText || "";
              const heading = card.querySelector("h2, h3, h4, h5, strong, b, [class*='name']");
              const candidateName = heading ? (heading as HTMLElement).innerText?.trim() : "";
              const titleEl = card.querySelector("[class*='title'], [class*='role'], [class*='position'], small, em, p");
              const candidateTitle = titleEl ? (titleEl as HTMLElement).innerText?.trim() : "";

              // Must look like a real person name (2+ words, reasonable length)
              if (!candidateName || candidateName.length < 4 || candidateName.length > 60 || candidateName.split(" ").length < 2) return;

              // Check if this card has an email
              const mailtoLink = card.querySelector('a[href^="mailto:"]');
              const email = mailtoLink ? (mailtoLink as HTMLAnchorElement).href.replace("mailto:", "").split("?")[0].toLowerCase() : "";

              // Check for LinkedIn link
              const linkedinLink = card.querySelector('a[href*="linkedin.com/in/"]');
              const linkedin = linkedinLink ? (linkedinLink as HTMLAnchorElement).href : "";

              // Check for phone (tel: link or inline text)
              const telLink = card.querySelector('a[href^="tel:"]');
              let cardPhone = telLink ? (telLink as HTMLAnchorElement).href.replace("tel:", "").trim() : "";
              if (!cardPhone) {
                const phoneMatch = cardText.match(/(?:\+?1[\s.-]?)?\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/);
                if (phoneMatch) cardPhone = phoneMatch[0].trim();
              }

              // If we already have this email in contacts, update the name/title
              if (email && seenEmails.has(email)) {
                const existing = contacts.find(c => c.email === email);
                if (existing && !existing.name && candidateName) {
                  existing.name = candidateName;
                  if (candidateTitle && candidateTitle.length < 80) existing.title = candidateTitle;
                  if (linkedin) existing.linkedin = linkedin;
                  if (cardPhone && !existing.phone) existing.phone = cardPhone;
                }
                return;
              }
              // Add as new contact to facilitate automatic or LLM-based orphan reconciliation
              if (candidateName) {
                if (email) seenEmails.add(email);
                // Prevent duplicate pure-orphan spam from multiple layout nodes on the same page
                if (!email && !linkedin && !cardPhone && contacts.some(c => c.name === candidateName)) {
                  // already added this orphan name, skip
                } else {
                  contacts.push({
                    name: candidateName,
                    title: (candidateTitle && candidateTitle.length < 80) ? candidateTitle : "",
                    email: email || "",
                    phone: cardPhone || "",
                    linkedin: linkedin || "",
                  });
                }
              }
            });
          } catch { /* selector may not exist */ }
        }

        // 4. Phone numbers
        const phoneRegex = /(?:\+?1[\s.-]?)?\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4}/g;
        const phones = Array.from(new Set(text.match(phoneRegex) || []));

        // Attach first phone to contacts without one
        if (phones.length > 0) {
          for (const contact of contacts) {
            if (!contact.phone) {
              contact.phone = phones[0];
              break;
            }
          }
        }

        // 5. Social links (company-level)
        const socials: Record<string, string> = {};
        const linkedinProfiles: string[] = [];
        const internalLinks: string[] = [];
        document.querySelectorAll("a[href]").forEach(a => {
          const href = (a as HTMLAnchorElement).href;
          if (href.includes("linkedin.com/company")) socials.linkedin = href;
          if (href.includes("linkedin.com/in/")) linkedinProfiles.push(href);
          if (href.includes("twitter.com/") || href.includes("x.com/")) socials.twitter = href;
          if (href.includes("facebook.com/")) socials.facebook = href;
          if (href.includes("instagram.com/")) socials.instagram = href;
          if (href.includes("github.com/")) socials.github = href;

          // Capture internal links for dynamic subpage discovery
          try {
            if (href && href.startsWith(window.location.origin)) {
              internalLinks.push(href.split("#")[0] || "");
            }
          } catch { /* ignore invalid URLs */ }
        });

        return {
          pageTitle, metaDesc, contacts, phones, socials, linkedinProfiles,
          internalLinks: Array.from(new Set(internalLinks)).filter(Boolean)
        };
      });
    };

    // Visit homepage
    let homeData: any = {};
    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await new Promise(r => setTimeout(r, 2000)); // Let JS render

      // Dismiss cookie banners / overlays
      try {
        const dismissSelectors = [
          'button[id*="accept"]', 'button[id*="cookie"]', 'button[class*="accept"]',
          'button[class*="cookie"]', 'a[id*="accept"]', '[aria-label*="accept"]',
          '[aria-label*="close"]', 'button[class*="close"]', '.cookie-banner button',
          '#cookie-consent button', '.gdpr button',
          // Age-gate selectors
          '[class*="age-gate"] button', '[class*="agegate"] button',
          '[class*="age-verify"] button', '[id*="age-gate"] button',
          'button[class*="age-confirm"]', 'button[class*="enter-site"]',
          'a[class*="enter-site"]', 'a[class*="age-confirm"]',
        ];
        for (const sel of dismissSelectors) {
          try {
            const btn = await page.$(sel);
            if (btn) { await btn.click(); break; }
          } catch { /* ignore */ }
        }
        // Text-based age-gate bypass for inline visit
        try {
          await page.evaluate(() => {
            const patterns = [
              /^yes$/i, /^enter$/i, /^i am (over |of legal |)?(18|19|21)\+?/i,
              /^(yes,? )?i am of (legal )?age/i, /^enter site$/i, /^continue$/i,
            ];
            const els = document.querySelectorAll('button, a[href], input[type="submit"]');
            for (const el of Array.from(els)) {
              const txt = ((el as HTMLElement).textContent || (el as HTMLInputElement).value || '').trim();
              if (txt.length > 0 && txt.length < 60 && patterns.some(p => p.test(txt))) {
                (el as HTMLElement).click();
                break;
              }
            }
          });
        } catch { /* ignore */ }
      } catch { /* ignore overlay dismiss errors */ }

      homeData = await extractPageData();
      title = homeData.pageTitle;
      description = homeData.metaDesc;
      (homeData.contacts || []).forEach((c: any) => { if (c.email) allEmails.add(c.email); });
      (homeData.phones || []).forEach((p: any) => allPhones.add(p));
      Object.assign(socialLinks, homeData.socials);
      allContacts.push(...(homeData.contacts || []));
      allLinkedinProfiles.push(...(homeData.linkedinProfiles || []));
      pagesVisited.push(targetUrl);
      console.log(`[PUPPETEER] Homepage: ${(homeData.contacts || []).length} contacts, ${(homeData.phones || []).length} phones`);
    } catch (navErr) {
      errors.push(`Homepage navigation failed: ${(navErr as Error).message}`);
    }

    // Priority subpages discovery: Combine dynamic on-page nav links with presets
    const keywordRegex = /\/(about|contact|team|leadership|people|staff|careers|profiles|directory|professionals|faculty|our-story)/i;
    let dynamicPaths: string[] = [];
    if (homeData.internalLinks) {
      const matchLinks = homeData.internalLinks
        .filter((href: string) => keywordRegex.test(href))
        .filter((href: string) => href.length < 150); // skip messy URLs
      // Sort to prioritize shorter, clean paths
      matchLinks.sort((a: string, b: string) => a.length - b.length);
      dynamicPaths = Array.from(new Set(matchLinks));
    }

    // Fallback preset paths
    const baseDomain = targetUrl.replace(/\/+$/, "");
    const presetPaths = ["/about", "/contact", "/team", "/about-us", "/contact-us", "/our-team", "/leadership", "/people", "/staff", "/careers", "/profiles", "/directory", "/professionals"]
      .map(p => `${baseDomain}${p}`);

    // Merge dynamic defaults, prioritizing real extracted dynamic nav routes first
    const allCandidates = Array.from(new Set([...dynamicPaths, ...presetPaths]));

    let subpagesVisited = 0;

    for (const subUrl of allCandidates) {
      if (subpagesVisited >= 5) break;
      // Skip redundant homepage attempts
      if (subUrl === targetUrl || subUrl === targetUrl + "/") continue;

      try {
        await assertSafeExternalUrl(subUrl);
        const response = await page.goto(subUrl, { waitUntil: "domcontentloaded", timeout: 12000 });

        // Skip 404s and redirects back to homepage
        if (response && response.status() >= 400) continue;
        const finalUrl = page.url();
        if (pagesVisited.includes(finalUrl)) continue;

        await new Promise(r => setTimeout(r, 1500));

        const subData = await extractPageData();
        // Merge contacts, deduplicating by email
        for (const c of subData.contacts) {
          if (c.email && allEmails.has(c.email)) {
            // Update existing contact with better data
            const existing = allContacts.find(ec => ec.email === c.email);
            if (existing) {
              if (!existing.name && c.name) existing.name = c.name;
              if (!existing.title && c.title) existing.title = c.title;
              if (!existing.linkedin && c.linkedin) existing.linkedin = c.linkedin;
            }
          } else {
            if (c.email) allEmails.add(c.email);
            allContacts.push(c);
          }
        }
        subData.phones.forEach(p => allPhones.add(p));
        Object.assign(socialLinks, subData.socials);
        allLinkedinProfiles.push(...(subData.linkedinProfiles || []));
        pagesVisited.push(subUrl);
        subpagesVisited++;

        if (!description && subData.metaDesc) description = subData.metaDesc;
        console.log(`[PUPPETEER] ${subUrl}: +${subData.contacts.length} contacts, +${subData.phones.length} phones`);
      } catch {
        // Subpage not found or timed out, continue
      }
    }

    const finalResult = {
      title,
      description,
      contacts: allContacts.slice(0, 20),
      emails: Array.from(allEmails).slice(0, 15),
      phones: Array.from(allPhones).slice(0, 10),
      socialLinks,
      linkedinProfiles: Array.from(new Set(allLinkedinProfiles)).slice(0, 10),
      techStack: [] as string[],
      pagesVisited: pagesVisited.filter(Boolean),
      errors,
    };

    // 3. Cache result globally
    if (domain) {
      try {
        const dedupeKey = `company:${domain}`;
        const existing = await db.crm_Global_Companies.findFirst({
          where: { OR: [{ domain }, { dedupeKey }] },
          select: { id: true },
        });

        const cacheData = {
          companyName: title,
          description,
          techStack: finalResult.techStack,
          emails: finalResult.emails,
          phones: finalResult.phones,
          socialLinks: finalResult.socialLinks,
          lastSeen: new Date(),
        };

        if (existing) {
          await db.crm_Global_Companies.update({
            where: { id: existing.id },
            data: cacheData,
          });
        } else {
          await db.crm_Global_Companies.create({
            data: { ...cacheData, domain, dedupeKey, firstSeen: new Date(), status: "ACTIVE" },
          });
        }
      } catch (cacheErr) {
        // Silently ignore — cache is best-effort
      }
    }

    return finalResult;
  } catch (error) {
    console.error("[VISIT_WEBSITE] Puppeteer error:", error);
    return { error: (error as Error).message };
  } finally {
    if (browser) await closeBrowser(browser);
  }
}

/**
 * Use AI to enrich missing company fields
 */
// Imports moved to top

/**
 * Use AI to enrich missing company fields
 */
export async function enrichCompanyDataWithAI(
  domain: string,
  extractedData: any,
  userId: string,
  icp: ICPConfig
): Promise<{
  companyName: string;
  description: string;
  industry: string;
}> {
  try {
    const { model } = await getAiSdkModel(userId, "enrichment");
    if (!model) {
      return {
        companyName: domain,
        description: `Business website: ${domain}`,
        industry: icp.industries?.[0] || "General Business"
      };
    }

    const prompt = `You are analyzing a company website to extract structured business information.

DOMAIN: ${domain}
WEBSITE TITLE: ${extractedData.title || 'N/A'}
META DESCRIPTION: ${extractedData.description || 'N/A'}
FOUND EMAILS: ${extractedData.emails?.join(', ') || 'N/A'}
FOUND PHONES: ${extractedData.phones?.join(', ') || 'N/A'}
DETECTED TECH: ${extractedData.techStack?.join(', ') || 'N/A'}

TARGET ICP:
- Industries: ${icp.industries?.join(", ") || "Any"}
- Geographies: ${icp.geos?.join(", ") || "Any"}

Based on this information, provide:
1. companyName: The business name
2. description: A clear 1-2 sentence description
3. industry: The primary industry`;

    const { object } = await generateObject({
      model,
      schema: z.object({
        companyName: z.string(),
        description: z.string(),
        industry: z.string(),
      }),
      messages: [
        { role: "system", content: "You are an expert at analyzing company websites." },
        { role: "user", content: prompt },
      ],
    });

    return object;
  } catch (error) {
    console.error("AI enrichment failed:", error);
  }

  // Fallback
  return {
    companyName: domain,
    description: `Business website: ${domain}`,
    industry: icp.industries?.[0] || "General Business"
  };
}

/**
 * Execute agent tool call
 * Checks job status before executing — bails out if job was stopped/paused
 */
export async function executeToolCall(toolName: string, args: any, context: any): Promise<any> {
  let jobData: any = null;
  // ── Abort check: bail out immediately if job was stopped ──
  try {
    jobData = await (prismadbCrm as any).crm_Lead_Gen_Jobs.findUnique({
      where: { id: context.jobId },
      select: { status: true, providers: true }
    });
    if (jobData?.status === "STOPPED") {
      console.log(`[TOOL_ABORT] ${toolName} aborted — job was stopped by user`);
      return { success: false, aborted: true, reason: "Job stopped by user" };
    }
  } catch (e) {
    // Non-fatal: continue if status check fails
  }

  switch (toolName) {
    case "search_companies":
      const searchProvider = jobData?.providers?.searchProvider || "ddg";
      let searchResults;
      
      if (searchProvider === "scraper-api") {
        const { scraperApiGoogleSearch } = await import("@/lib/scraper/scraper-api");
        searchResults = await scraperApiGoogleSearch(args.query, args.count || 20);
      } else if (searchProvider === "google-stealth") {
        searchResults = await googlePuppeteerSearch(args.query, args.count || 20);
      } else {
        searchResults = await ddgWebSearch(args.query, args.count || 20, context.jobId);
      }
      // Log the search outcome to the job for traceability
      try {
        const top = searchResults.slice(0, 5).map(r => r.domain || (r.url ? extractDomain(r.url) : '')).filter(Boolean).join(', ');

        // Fetch current job to get existing queryTemplates and logs
        const job = await (prismadbCrm as any).crm_Lead_Gen_Jobs.findUnique({
          where: { id: context.jobId },
          select: { queryTemplates: true, logs: true }
        });

        const existingTemplates = Array.isArray(job?.queryTemplates) ? job.queryTemplates : [];
        const newTemplates = Array.from(new Set([...existingTemplates, args.query]));

        await (prismadbCrm as any).crm_Lead_Gen_Jobs.update({
          where: { id: context.jobId },
          data: {
            queryTemplates: newTemplates,
            logs: [
              ...(Array.isArray(job?.logs) ? job.logs : []),
              { ts: new Date().toISOString(), msg: `🔍 search_companies("${args.query}") -> ${searchResults.length} results. Top: ${top || 'none'}` }
            ]
          }
        });
      } catch (dbErr) {
        console.error("Failed to update job for search query", dbErr);
      }
      // Truncate results to reduce token usage — only send top 10 with minimal fields
      const trimmedResults = searchResults.slice(0, 10).map((r: any) => ({
        title: (r.title || '').slice(0, 80),
        url: r.url,
        domain: r.domain || (r.url ? extractDomain(r.url) : ''),
        snippet: (r.snippet || '').slice(0, 120),
      }));
      return {
        success: true,
        results: trimmedResults,
        count: searchResults.length
      };

    case "explore_website_structure": {
      const urlObj = args.url.startsWith("http") ? args.url : `https://${args.url}`;
      try {
        await assertSafeExternalUrl(urlObj);
      } catch (ssrfErr: any) {
        return { success: false, url: args.url, error: ssrfErr?.message || "Blocked unsafe URL" };
      }
      let rawHtml = "";
      
      const useScraperApiForVisit = jobData?.providers?.searchProvider === "scraper-api";
      if (useScraperApiForVisit) {
        const { scraperApiExtractHtml } = await import("@/lib/scraper/scraper-api");
        rawHtml = await scraperApiExtractHtml(urlObj) || "";
      } else {
        const { launchBrowser, newPageWithDefaults, closeBrowser } = await import("@/lib/scraper-browser");
        let browser;
        try {
          browser = await launchBrowser();
          const page = await newPageWithDefaults(browser);
          await installScraperSsrfGuard(page);
          await page.goto(urlObj, { waitUntil: "domcontentloaded", timeout: 20000 });
          // Dismiss overlays text-based
          await new Promise(r => setTimeout(r, 1500));
          rawHtml = await page.evaluate(() => document.documentElement.outerHTML);
        } catch(e) {
          console.error("Puppeteer fail", e);
        } finally {
          if (browser) await closeBrowser(browser);
        }
      }

      if (!rawHtml) return { success: false, url: args.url, error: "Failed to load HTML" };

      // Use cheerio to parse the DOM
      const cheerio = await import("cheerio");
      const $ = cheerio.load(rawHtml);
      $('script, style, svg, path, iframe, noscript').remove();

      const cache: Record<string, string> = {};
      cache['header'] = $('header').text() || '';
      cache['footer'] = $('footer').text() || '';
      cache['main'] = $('main').text() || $('body').text()?.substring(0, 10000) || '';
      cache['#contact'] = $('.contact, .contact-us, #contact, address, .footer').text() || '';

      // Initialize domCache for this URL
      context.domCache[urlObj] = cache;

      const baseDomain = extractDomain(urlObj);
      const sublinks = Array.from(new Set($('a[href]').map((i, el) => $(el).attr('href')).get()))
          .filter(h => h && (h.startsWith('/') || h.includes(baseDomain)))
          .slice(0, 25); // cap at 25 links

      try {
        const job = await (prismadbCrm as any).crm_Lead_Gen_Jobs.findUnique({
          where: { id: context.jobId }, select: { logs: true }
        });
        await (prismadbCrm as any).crm_Lead_Gen_Jobs.update({
          where: { id: context.jobId },
          data: {
            logs: [
              ...(Array.isArray(job?.logs) ? job.logs : []),
              { ts: new Date().toISOString(), msg: `👁️ explore_website_structure("${urlObj}") -> Found ${Object.keys(cache).length} sections, ${sublinks.length} sublinks.` }
            ]
          }
        });
      } catch (dbErr) { console.error("Failed to update job log", dbErr); }

      return {
        success: true,
        url: urlObj,
        message: "Successfully scanned. Use read_html_component on these components to extract contacts.",
        available_components: Object.keys(cache).filter(k => cache[k]?.trim().length > 0),
        discovered_sublinks: sublinks
      };
    }

    case "read_html_component": {
      const urlObj = args.url.startsWith("http") ? args.url : `https://${args.url}`;
      if (!context.domCache[urlObj]) {
        return { success: false, error: "URL not explored yet. Use explore_website_structure first." };
      }
      const textContent = context.domCache[urlObj][args.component_id];
      if (!textContent) {
        return { success: false, error: `Component ${args.component_id} not found on this page.` };
      }
      
      const payloadLength = textContent.replace(/\s{2,}/g, ' ').trim().length;
      try {
        const job = await (prismadbCrm as any).crm_Lead_Gen_Jobs.findUnique({
          where: { id: context.jobId }, select: { logs: true }
        });
        await (prismadbCrm as any).crm_Lead_Gen_Jobs.update({
          where: { id: context.jobId },
          data: {
            logs: [
              ...(Array.isArray(job?.logs) ? job.logs : []),
              { ts: new Date().toISOString(), msg: `📖 read_html_component("${args.component_id}") on ${urlObj} -> Retrieved chunk (${payloadLength} chars)` }
            ]
          }
        });
      } catch (dbErr) { console.error("Failed to update job log", dbErr); }

      return {
        success: true,
        url: args.url,
        component_id: args.component_id,
        // We return the raw scraped text, collapsing extreme whitespace to save tokens
        textPayload: textContent.replace(/\s{2,}/g, ' ').trim().slice(0, 4000) 
      };
    }

    case "analyze_company_fit":
      // AI will analyze this in its next turn
      return {
        success: true,
        domain: args.domain,
        ready_for_analysis: true
      };

    case "save_company":
      const db: any = prismadbCrm;
      const domain = normalizeDomain(args.domain);

      // Blacklist Check: Ensure we don't save already existing customers
      try {
        const { prismadb: mainDb } = await import("@/lib/prisma");
        const existingAccount = await (mainDb as any).crm_Accounts.findFirst({
          where: {
            OR: [
              { website: { contains: domain } },
              { website: { endsWith: domain } }
            ]
          }
        });
        if (existingAccount) {
          console.log(`[SAVE_COMPANY] Blacklisted: ${domain} is already a customer in crm_Accounts.`);
          return { success: false, error: "Company is already an existing customer (Blacklisted)." };
        }
      } catch (e) {
        console.warn("[SAVE_COMPANY] Blacklist check error:", e);
      }

      console.log("[SAVE_COMPANY] Validating company:", {
        domain,
        companyName: args.companyName,
        hasDescription: !!args.description,
        hasIndustry: !!args.industry,
        contactCount: args.contacts?.length || 0
      });

      if (!domain) {
        console.log("[SAVE_COMPANY] Validation failed: Invalid domain");
        return { success: false, error: "Invalid domain" };
      }

      // Directory / aggregator domain blocklist — these are never real leads
      const DIRECTORY_DOMAINS = new Set([
        'crunchbase.com', 'linkedin.com', 'f6s.com', 'tracxn.com', 'growthlist.co',
        'pitchbook.com', 'owler.com', 'zoominfo.com', 'apollo.io', 'clearbit.com',
        'builtwith.com', 'stackshare.io', 'g2.com', 'capterra.com', 'clutch.co',
        'glassdoor.com', 'indeed.com', 'yelp.com', 'bbb.org', 'trustpilot.com',
        'producthunt.com', 'angel.co', 'wellfound.com', 'techcrunch.com',
        'bloomberg.com', 'reuters.com', 'forbes.com', 'inc.com', 'entrepreneur.com',
        'wikipedia.org', 'reddit.com', 'twitter.com', 'x.com', 'facebook.com',
        'instagram.com', 'youtube.com', 'tiktok.com', 'github.com',
        'ycombinator.com', 'similarweb.com', 'alexa.com', 'semrush.com',
        'manta.com', 'dnb.com', 'hoovers.com', 'yellowpages.com',
        'mapquest.com', 'google.com', 'bing.com', 'yahoo.com',
      ]);
      if (DIRECTORY_DOMAINS.has(domain)) {
        console.log(`[SAVE_COMPANY] Validation failed: "${domain}" is a directory/aggregator, not a real lead`);
        return { success: false, error: `"${domain}" is a directory/aggregator website, not a prospectable company` };
      }

      // Validate: Must have at least one contact with email or phone
      if (!args.contacts || !Array.isArray(args.contacts) || args.contacts.length === 0) {
        console.log("[SAVE_COMPANY] Validation failed: No contacts");
        return { success: false, error: "Cannot save company without contacts — include at least a phone number or email (role emails like info@ are fine)" };
      }
      // ── Contact Name Quality Validation ──
      // Reject names that are company names, department labels, or generic placeholders
      const companyNameLower = (args.companyName || "").toLowerCase().trim();
      const domainBase = domain.split(".")[0]?.toLowerCase() || "";
      const BOGUS_NAME_PATTERNS = [
        /^(general\s+)?contact$/i, /^customer\s*service$/i, /^sales$/i,
        /^support$/i, /^info$/i, /^admin$/i, /^billing$/i, /^hr$/i,
        /^marketing$/i, /^office$/i, /^reception$/i, /^help\s*desk$/i,
        /^accounts?$/i, /^enquir(y|ies)$/i, /^team$/i, /^staff$/i,
        /^management$/i, /^operations$/i, /^service$/i, /^direct$/i,
        /^unknown$/i, /^n\/?a$/i, /^none$/i, /^-$/,
      ];
      const BOGUS_TITLE_PATTERNS = [
        /^contact$/i, /^general\s+contact$/i, /^n\/?a$/i, /^unknown$/i,
        /^-$/i, /^none$/i, /^employee$/i, /^staff$/i, /^company$/i,
      ];

      for (const contact of (args.contacts || [])) {
        const nameLower = (contact.name || "").toLowerCase().trim();

        // Clear name if it matches/contains the company name (or vice versa)
        if (nameLower && companyNameLower) {
          const nameNorm = nameLower.replace(/[^a-z0-9\s]/g, "");
          const compNorm = companyNameLower.replace(/[^a-z0-9\s]/g, "");
          if (nameNorm === compNorm || compNorm.includes(nameNorm) || nameNorm.includes(compNorm) || nameNorm.includes(domainBase)) {
            console.log(`[SAVE_COMPANY] Clearing bogus name "${contact.name}" (matches company name)`);
            contact.name = "";
          }
        }

        // Clear names that are department labels or generic placeholders
        if (contact.name && BOGUS_NAME_PATTERNS.some(p => p.test(contact.name.trim()))) {
          console.log(`[SAVE_COMPANY] Clearing bogus name "${contact.name}" (generic label)`);
          contact.name = "";
        }

        // Clear bogus titles
        if (contact.title && BOGUS_TITLE_PATTERNS.some(p => p.test(contact.title.trim()))) {
          contact.title = "";
        }

        // If email local part looks like a name (firstname.lastname), derive the name
        if (!contact.name && contact.email) {
          const local = contact.email.split("@")[0] || "";
          // Check if local part has name-like pattern: first.last, first_last, firstlast
          const nameParts = local.split(/[._\-]/);
          if (nameParts.length >= 2 && nameParts.every((p: string) => p.length >= 2 && /^[a-zA-Z]+$/.test(p))) {
            contact.name = nameParts.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
          }
        }
      }

      // Augment contacts with pattern-based guesses behind feature flag
      const augmentedContacts: any[] = Array.isArray(args.contacts) ? [...args.contacts] : [];
      if (ScraperConfig.patternGuess.enabled && domain) {
        try {
          const observedPairs = augmentedContacts
            .filter((c) => c?.name && c?.email)
            .map((c) => ({ name: String(c.name), email: String(c.email).toLowerCase() }));
          if (observedPairs.length > 0) {
            const ttlMs = ScraperConfig.patternGuess.ttlDays * 24 * 60 * 60 * 1000;
            learnDomainPatterns(domain, observedPairs, ttlMs);
          }
          for (const c of augmentedContacts) {
            if (!c.email && c.name) {
              const guesses = guessEmailForName(domain, c.name, 1);
              const top = guesses[0];
              if (top && top.confidence >= ScraperConfig.patternGuess.minConfidenceToAssign) {
                c.email = top.email;
                (c as any).__patternGuess = top; // temp: attach for provenance
              }
            }
          }
        } catch (e) {
          console.warn("[SAVE_COMPANY] Pattern model error:", (e as Error).message);
        }
      }

      // Strip ghost contacts — orphan names that didn't merge with any email or phone
      const viableContacts = augmentedContacts.filter((c: any) =>
        (c.email && c.email.trim().length > 0) || (c.phone && c.phone.trim().length > 0)
      );

      // Require at least one contact with email OR phone
      const contactsWithEmails = viableContacts.filter((c: any) => c.email && c.email.trim().length > 0);
      const contactsWithPhones = viableContacts.filter((c: any) => c.phone && c.phone.trim().length > 0);
      console.log("[SAVE_COMPANY] Viable contacts:", viableContacts.length, "| with emails:", contactsWithEmails.length, "| with phones:", contactsWithPhones.length);

      if (contactsWithEmails.length === 0 && contactsWithPhones.length === 0) {
        console.log("[SAVE_COMPANY] Validation failed: No emails or phones found");
        return { success: false, error: "Cannot save company without at least one email or phone number (role emails like info@ are acceptable)" };
      }

      // Pick the best account-level email: prefer first email with a real name, fall back to any email found
      const bestAccountEmail =
        contactsWithEmails.find((c: any) => c.name && c.name.trim().split(/\s+/).length >= 2)?.email ||
        contactsWithEmails[0]?.email ||
        null;

      // Use AI to enrich missing fields if not provided
      let companyName = args.companyName;
      let description = args.description;
      let industry = args.industry;

      // If any field is missing, use AI to enrich
      if (!companyName || !description || !industry) {
        console.log("[SAVE_COMPANY] Enriching missing fields with AI...");
        const enriched = await enrichCompanyDataWithAI(
          domain,
          {
            title: args.companyName,
            description: args.description,
            emails: args.contacts?.map((c: any) => c.email).filter(Boolean),
            phones: args.contacts?.map((c: any) => c.phone).filter(Boolean),
            techStack: args.techStack
          },
          context.userId,
          context.icp
        );

        companyName = companyName || enriched.companyName;
        description = description || enriched.description;
        industry = industry || enriched.industry;

        console.log("[SAVE_COMPANY] AI enrichment complete:", {
          companyName,
          industry,
          descLength: description.length
        });
      }

      console.log("[SAVE_COMPANY] Saving with complete data:", {
        companyName,
        hasDescription: !!description,
        industry,
        contactCount: contactsWithEmails.length
      });

      try {
        // Save to global index (findFirst + update/create to avoid dedupeKey constraint)
        const dedupeKey = generateCompanyDedupeKey(domain);
        const existingGlobal = await db.crm_Global_Companies.findFirst({
          where: { OR: [{ domain }, { dedupeKey }] },
          select: { id: true },
        });
        const globalCacheData = {
          companyName,
          description,
          industry,
          techStack: args.techStack || [],
          lastSeen: new Date(),
        };
        if (existingGlobal) {
          await db.crm_Global_Companies.update({
            where: { id: existingGlobal.id },
            data: globalCacheData,
          });
        } else {
          await db.crm_Global_Companies.create({
            data: { ...globalCacheData, domain, dedupeKey, firstSeen: new Date(), status: "ACTIVE", provenance: { source: "agentic_ai", jobId: context.jobId } },
          });
        }

        // Calculate quality score based on data completeness
        // Base score starts at 50, add points for quality signals
        let qualityScore = 50;

        // +10 points for each contact found (up to +30)
        qualityScore += Math.min(contactsWithEmails.length * 10, 30);

        // +10 points if we have multiple emails
        const emailCount = viableContacts.filter((c: any) => c.email).length;
        if (emailCount >= 2) qualityScore += 10;

        // +5 points for tech stack
        if (args.techStack && args.techStack.length > 0) qualityScore += 5;

        // +5 points for complete company info
        if (description && description.length > 50) qualityScore += 5;

        // Cap at 95 (ICP scoring will adjust from there)
        qualityScore = Math.min(qualityScore, 95);

        // Save to user pool (de-duplicate within pool by dedupeKey)
        const existingCandidate = await db.crm_Lead_Candidates.findFirst({
          where: { pool: context.poolId, dedupeKey }
        });

        // Prepare merged tech stack
        const incomingTech: string[] = Array.isArray(args.techStack) ? args.techStack : [];
        const mergeTech = (a?: any, b?: any) => Array.from(new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]));

        let candidate: any;
        if (existingCandidate) {
          const mergedTech = mergeTech(existingCandidate.techStack, incomingTech);
          const mergedScore = Math.max(existingCandidate.score || 0, qualityScore);
          const betterDescription = (existingCandidate.description?.length || 0) >= (description?.length || 0)
            ? existingCandidate.description
            : description;
          const finalCompanyName = existingCandidate.companyName || companyName;
          const finalIndustry = existingCandidate.industry || industry;

          candidate = await db.crm_Lead_Candidates.update({
            where: { id: existingCandidate.id },
            data: {
              companyName: finalCompanyName,
              description: betterDescription,
              industry: finalIndustry,
              techStack: mergedTech,
              homepageUrl: existingCandidate.homepageUrl || `https://${domain}`,
              score: mergedScore,
              // keep earliest status or set to NEW if missing
              status: existingCandidate.status || "NEW",
              provenance: { source: "agentic_ai", jobId: context.jobId, merged: true }
            }
          });
        } else {
          candidate = await db.crm_Lead_Candidates.create({
            data: {
              pool: context.poolId,
              domain,
              dedupeKey,
              companyName,
              description,
              industry,
              techStack: incomingTech,
              homepageUrl: `https://${domain}`,
              score: qualityScore,
              status: "NEW",
              provenance: { source: "agentic_ai", jobId: context.jobId }
            }
          });
        }

        // Save ALL contacts with emails or phones (including role emails like info@)
        let contactsSavedCount = 0;
        let validEmailCount = 0;
        let personaDecisionMakerFound = false;
        if (viableContacts && Array.isArray(viableContacts)) {
          for (const contact of viableContacts) {
            const cleaned = sanitizeContact({
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              title: contact.title,
              linkedin: contact.linkedin,
            }, { deprioritizeRoleEmails: false }); // allow role emails — they're valid company contacts

            if (cleaned) {
              let email = cleaned.email || null;
              const phone = cleaned.phone || null;

              // Require at least email OR phone — drop truly empty contacts
              if (!email && !phone) {
                continue;
              }

              // Optional email verification (syntax-only by default; adapters can extend MX/SMTP)
              let emailStatus: any = "UNKNOWN";
              let verificationResult: any = null;
              let confScore = 70;
              try {
                if (ScraperConfig.verify.enabled && email) {
                  const verification = await verifyEmail(email, {
                    stages: ScraperConfig.verify.stages,
                    cacheTtlMs: ScraperConfig.verify.domainTtlDays * 24 * 60 * 60 * 1000,
                    domainTtlMs: ScraperConfig.verify.domainTtlDays * 24 * 60 * 60 * 1000,
                    smtpTtlMs: ScraperConfig.verify.smtpTtlDays * 24 * 60 * 60 * 1000,
                    adapters: ScraperConfig.verify.useAdapters ? buildResendAdapters() : undefined,
                  });
                  verificationResult = verification;
                  if (verification.steps.catchAll?.value === "yes") {
                    emailStatus = "CATCH_ALL";
                    confScore = Math.max(confScore, 65);
                  } else if (verification.status === "valid") {
                    emailStatus = "VALID";
                    confScore = Math.max(confScore, 85);
                    validEmailCount++;
                  } else if (verification.status === "risky") {
                    emailStatus = "RISKY";
                    confScore = Math.max(confScore, 70);
                  } else if (verification.status === "invalid") {
                    emailStatus = "INVALID";
                    email = null; // drop invalid
                    confScore = Math.max(confScore, 50);
                  }
                }
              } catch (e) {
                // Non-fatal: keep email if present
              }

              // After verification, if email was nulled and no phone exists, skip
              if (!email && !phone) continue;

              // Build a safe display name using email/company/domain fallbacks (avoid "Direct Direct")
              let safeName = cleaned.name || safeContactDisplayName(
                contact.name,
                cleaned.email,
                companyName,
                domain
              );
              // Ensure concatenations are fixed
              safeName = fixConcat(safeName) || safeName;

              const personDedupeKey = generatePersonDedupeKey(
                email || phone || "",
                safeName,
                domain,
                cleaned.title
              );

              // Title normalization & persona tagging
              const titleInfo = normalizeTitleAndPersona(cleaned.title);
              if (titleInfo) {
                const isDecisionMaker =
                  titleInfo.persona === "TECH_DECISION_MAKER" ||
                  (titleInfo.ladder === "C-SUITE" || titleInfo.ladder === "VP" || titleInfo.ladder === "DIRECTOR");
                if (isDecisionMaker) personaDecisionMakerFound = true;
              }

              const existingContact = await db.crm_Contact_Candidates.findFirst({
                where: { leadCandidate: candidate.id, dedupeKey: personDedupeKey }
              });

              if (existingContact) {
                // Merge missing fields; keep existing confidence if higher
                await db.crm_Contact_Candidates.update({
                  where: { id: existingContact.id },
                  data: {
                    fullName: normalizeName(safeName) || existingContact.fullName,
                    title: existingContact.title || (titleInfo?.normalizedTitle ?? cleaned.title) || null,
                    email: existingContact.email || email || null,
                    phone: existingContact.phone || phone || null,
                    linkedinUrl: existingContact.linkedinUrl || cleaned.linkedin || null,
                    emailStatus: (existingContact as any).emailStatus || emailStatus,
                    confidence: Math.max(existingContact.confidence || 0, confScore),
                    provenance: {
                      ...(existingContact.provenance || {}),
                      merged: true,
                      jobId: context.jobId,
                      normalizedTitle: titleInfo || undefined,
                      patternGuess: (contact as any).__patternGuess || undefined,
                      emailVerification: verificationResult || undefined,
                    }
                  }
                });
              } else {
                await db.crm_Contact_Candidates.create({
                  data: {
                    leadCandidate: candidate.id,
                    fullName: normalizeName(safeName) || safeName,
                    title: (titleInfo?.normalizedTitle ?? cleaned.title) || null,
                    email: email || null,
                    phone: phone || null,
                    linkedinUrl: cleaned.linkedin || null,
                    dedupeKey: personDedupeKey,
                    emailStatus: emailStatus,
                    confidence: confScore,
                    status: "NEW",
                    provenance: {
                      source: "agentic_ai",
                      jobId: context.jobId,
                      normalizedTitle: titleInfo || undefined,
                      patternGuess: (contact as any).__patternGuess || undefined,
                      emailVerification: verificationResult || undefined,
                    }
                  }
                });
                contactsSavedCount++;
              }
            }
          }
        }

        try {
          let adjustedScore = qualityScore;
          if (personaDecisionMakerFound) adjustedScore = Math.min(adjustedScore + 10, 95);
          if (validEmailCount >= 2) adjustedScore = Math.min(adjustedScore + 5, 95);
          await db.crm_Lead_Candidates.update({
            where: { id: candidate.id },
            data: { score: Math.max(candidate.score || 0, adjustedScore) }
          });
        } catch { }

        // ═══════════════════════════════════════════════════════════════════
        // CREATE crm_Accounts entry for every scraped company
        // ═══════════════════════════════════════════════════════════════════
        let crmAccountId: string | null = null;
        let accountHasContactInfo = false;
        // Track unique contact info pieces for billing (1 credit = 1 unique email or phone)
        const billedContactInfo = new Set<string>();
        try {
          const { prismadb: mainDb } = await import("@/lib/prisma");
          const teamId = context.teamId || null;

          // De-duplicate by website domain within the same team
          const existingCrmAccount = await (mainDb as any).crm_Accounts.findFirst({
            where: {
              AND: [
                {
                  OR: [
                    { website: { contains: domain } },
                    { website: { endsWith: domain } },
                  ]
                },
                ...(teamId ? [{ team_id: teamId }] : []),
              ]
            },
            select: { id: true }
          });

          if (existingCrmAccount) {
            crmAccountId = existingCrmAccount.id;
            console.log(`[SAVE_COMPANY] Reusing existing crm_Accounts entry for ${domain}: ${crmAccountId}`);
          } else {
            const newAccount = await (mainDb as any).crm_Accounts.create({
              data: {
                v: 0,
                name: companyName,
                website: `https://${domain}`,
                description: description ? `${description}${industry ? `\nIndustry: ${industry}` : ''}` : undefined,
                // Use the best available account-level email (including role emails like info@)
                email: bestAccountEmail || null,
                office_phone: augmentedContacts.find((c: any) => c.phone?.trim())?.phone || null,
                // industry is an ObjectId referencing crm_Industry_Type, so we don't pass the raw string.
                // The raw industry string is already appended to the description above.
                status: "Active",
                type: "Prospect",
                ...(teamId ? { team_id: teamId } : {}),
              }
            });
            crmAccountId = newAccount.id;

            // Track billable contact info pieces for new account
            if (bestAccountEmail) billedContactInfo.add(`email:${bestAccountEmail.toLowerCase().trim()}`);
            const acctPhone = augmentedContacts.find((c: any) => c.phone?.trim())?.phone;
            if (acctPhone) billedContactInfo.add(`phone:${acctPhone.replace(/\D/g, '')}`);
            accountHasContactInfo = billedContactInfo.size > 0;

            console.log(`[SAVE_COMPANY] Created new crm_Accounts entry for ${domain}: ${crmAccountId}`);
          }

          // Link the Lead Candidate to this account
          if (crmAccountId) {
            try {
              await db.crm_Lead_Candidates.update({
                where: { id: candidate.id },
                data: { accountsIDs: crmAccountId }
              });
            } catch { /* non-fatal — candidate may not have accountsIDs field */ }
          }

          // ═══════════════════════════════════════════════════════════════
          // CREATE crm_Contacts for named individuals AND role-email contacts
          // ═══════════════════════════════════════════════════════════════
          if (crmAccountId) {
            for (const contact of augmentedContacts) {
              const cleaned = sanitizeContact({
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                title: contact.title,
                linkedin: contact.linkedin,
              }, { deprioritizeRoleEmails: false });
              if (!cleaned || !cleaned.email) continue;

              // Only create a crm_Contacts record for real named individuals.
              // Role/generic emails (info@, contact@, sales@) are already stored at the
              // account level via crm_Accounts.email — do NOT create a contact for them.
              const titleInfo = normalizeTitleAndPersona(cleaned.title);
              const safeName = normalizeName(cleaned.name || '') || '';
              const words = safeName.trim().split(/\s+/);

              // Enforce realistic name constraints
              const isReasonableLength = words.length >= 2 && words.length <= 4;
              // Allow standard letters, spaces, hyphens, and apostrophes along with common accents.
              // We avoid the /u flag for strict-mode ES5 TS target compatibility.
              const hasValidCharacters = /^[a-zA-Z\u00C0-\u017F\s\-\']+$/.test(safeName.trim());
              // Reject placeholders like "General Contact", "Admin Contact"
              const isPlaceholderName = /\bContact$/i.test(safeName.trim());

              const isRealName = isReasonableLength && hasValidCharacters && !isPlaceholderName;
              if (!isRealName) continue; // skip role contacts and junk text — they live on the account only

              // De-duplicate by email within the same team
              const existingContact = await (mainDb as any).crm_Contacts.findFirst({
                where: {
                  email: cleaned.email,
                  ...(teamId ? { team_id: teamId } : {}),
                },
                select: { id: true, accountsIDs: true }
              });

              if (existingContact) {
                // Bind to account if not already bound
                if (!existingContact.accountsIDs && crmAccountId) {
                  try {
                    await (mainDb as any).crm_Contacts.update({
                      where: { id: existingContact.id },
                      data: { assigned_accounts: { connect: { id: crmAccountId } } }
                    });
                  } catch { /* non-fatal */ }
                }
                continue;
              }

              // Split real name into first/last
              const nameParts = safeName.trim().split(/\s+/);
              const firstName = nameParts.slice(0, -1).join(' ');
              const lastName = nameParts[nameParts.length - 1] || safeName;

              try {
                await (mainDb as any).crm_Contacts.create({
                  data: {
                    first_name: firstName,
                    last_name: lastName,
                    email: cleaned.email,
                    office_phone: cleaned.phone || null,
                    position: (titleInfo?.normalizedTitle ?? cleaned.title) || null,
                    social_linkedin: cleaned.linkedin || null,
                    type: "Prospect",
                    description: `Scraped from ${domain} via Lead Gen AI`,
                    assigned_accounts: { connect: { id: crmAccountId } },
                    ...(teamId ? { assigned_team: { connect: { id: teamId } } } : {}),
                  }
                });
                console.log(`[SAVE_COMPANY] Created crm_Contacts entry: ${cleaned.email} under account ${crmAccountId}`);
                // Track billable info pieces (deduped against account-level via Set)
                if (cleaned.email) billedContactInfo.add(`email:${cleaned.email.toLowerCase().trim()}`);
                if (cleaned.phone) billedContactInfo.add(`phone:${cleaned.phone.replace(/\D/g, '')}`);
              } catch (contactErr) {
                console.warn(`[SAVE_COMPANY] Failed to create crm_Contacts for ${cleaned.email}:`, contactErr);
              }
            }
          }
        } catch (accountErr) {
          const errMsg = (accountErr as Error).message || String(accountErr);
          console.warn(`[SAVE_COMPANY] crm_Accounts/Contacts creation error for ${domain}:`, accountErr);
          // Surface this error in the job log so it appears in the dashboard
          context.logs?.push({ ts: new Date().toISOString(), msg: `⚠️ Account save error for ${domain}: ${errMsg}`, level: "WARN" });
        }
        return {
          success: true,
          candidateId: candidate.id,
          contactsCreated: contactsSavedCount,
          contactInfoCredits: billedContactInfo.size,
          accountHasContactInfo: accountHasContactInfo
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message
        };
      }

    case "refine_search_strategy":
      // Log the agent's reasoning
      const db2: any = prismadbCrm;
      await db2.crm_Lead_Gen_Jobs.update({
        where: { id: context.jobId },
        data: {
          logs: [
            ...(context.logs || []),
            {
              ts: new Date().toISOString(),
              msg: `Agent reasoning: ${args.reasoning}`
            }
          ]
        }
      });
      return {
        success: true,
        shouldContinue: args.currentResults < args.targetResults
      };

    default:
      return { success: false, error: "Unknown tool" };
  }
}

/**
 * Run agentic AI lead generation
 * The AI autonomously searches, analyzes, and saves leads
 */
export async function runAgenticLeadGeneration(
  jobId: string,
  userId: string,
  icp: ICPConfig,
  poolId: string,
  maxCredits: number = 100,
  initialState?: {
    companiesSaved?: number;
    contactsSaved?: number;
    accountsWithContactInfoSaved?: number;
    queryTemplates?: string[];
  }
): Promise<{
  companiesSaved: number;
  contactsSaved: number;
  accountsWithContactInfoSaved: number;
  iterations: number;
}> {
  const db: any = prismadbCrm;

  // Resolve team_id for AI token tracking and model configuration routing
  let teamId: string | null = null;
  let isPlatformAdmin = false;
  try {
    const userRecord = await prismadb.users.findUnique({
      where: { id: userId },
      select: { team_id: true, is_admin: true, is_account_admin: true, assigned_role: { select: { name: true } } }
    });
    teamId = userRecord?.team_id || null;
    isPlatformAdmin = userRecord?.assigned_role?.name === "SuperAdmin" || userRecord?.is_admin || userRecord?.is_account_admin;
  } catch (e) {
    console.warn("[LEADGEN] Could not resolve team_id for token tracking", e);
  }

  const { model, provider, modelId } = await getAiSdkModel({ userId, teamId: teamId || undefined }, "enrichment");
  if (!model) {
    throw new Error("AI model not configured");
  }
  let accumulatedTokens = 0;
  let accumulatedPromptTokens = 0;
  let accumulatedCompletionTokens = 0;
  const isResume = !!initialState && (initialState.companiesSaved || 0) > 0;

  let companiesSaved = initialState?.companiesSaved || 0;
  let contactsSaved = initialState?.contactsSaved || 0;
  let accountsWithContactInfoSaved = initialState?.accountsWithContactInfoSaved || 0;
  let iterations = 0;

  let tokenHistory: { p: number, c: number, t: number }[] = [];

  // System prompt — structured for reliability, intelligent triangulation, and anti-hallucination
  let systemPrompt = `You are "Varuna", an elite, autonomous B2B Signal Intelligence Framework. You do not just scrape; you conduct high-fidelity, adversarial data extraction and cognitive synthesis. Your core mission is to prospect, triangulate, and exfiltrate verified contact records matching the provided Ideal Customer Profile (ICP).

BUDGET CONSTRAINT: Your operational loop ceases when you successfully consume ${maxCredits} credits.
- [ACCOUNT YIELD]: 1 credit = 1 company saved.
- [CONTACT YIELD]: 1 credit = 1 named person attached.

═══ ICP DIRECTIVES ═══
  Industries: ${icp.industries?.join(", ") || "Any"}
  Geographies: ${icp.geos?.join(", ") || "Any"}
  Tech Stack [OPTIONAL SIGNAL]: ${icp.techStack?.join(", ") || "Any"}
  Target Titles: ${icp.titles?.join(", ") || "Any"}
  ${icp.notes ? `Mission Notes: ${icp.notes}` : ""}

═══ OPERATIONAL MAXIMS ═══
[MAXIM 1: ZERO HALLUCINATION] You exist in a deterministic reality. Every string you pass to 'save_company' MUST be extracted verbatim from 'read_html_component', 'explore_website_structure', or search snippets. You will NEVER fabricate, infer, synthesize, or hallucinate a name, email, or phone.
[MAXIM 2: RELENTLESS RECONNAISSANCE] You will aggressively crawl domains. Call 'explore_website_structure' first to get the layout map. Then, actively call 'read_html_component' on specific blocks like footers, headers, or .contact-info. Businesses obfuscate contact data; you will find it.
[MAXIM 3: THE ENTERPRISE TRAP (ANTI-LOOP)] Do NOT get trapped crawling impenetrable institutional domains (massive hospital networks, giant .edu universities). These organizations bury contacts. If a massive domain yields 0 viable contacts after exploring its homepage + 1 sublink, ABANDON IT IMMEDIATELY. Pivot to targeting independent SMEs.
[MAXIM 4: THE SYNTHESIS PROTOCOL] You are a data synthesizer. Scraped data is usually fragmented. Actively correlate fragments into master personas. If you find {name: "Jane Doe"} and an orphan {email: "jdoe@company.com"}, you MUST synthesize them into a single coherent profile.
[MAXIM 5: FRAGMENT EXFILTRATION & RAPID DEPLOY] DO NOT WAIT. Call 'save_company' on a target as soon as you have actionable contact data. Do not discard orphan data. If a contact has ONLY an email, ONLY a phone, or ONLY a name—EXFILTRATE IT ANYWAY. 
[MAXIM 6: MAXIMUM PARALLELIZATION] You can and MUST execute tools in parallel! If 'search_companies' yields 5 promising domains, you MUST invoke 'explore_website_structure' on ALL 5 domains simultaneously in the exact same response block. Move fast.

═══ MISSION CYCLE (THE VARUNA LOOP) ═══
1. [ACQUIRE]: Call 'search_companies' with hyper-specific, intent-driven boolean queries (e.g., "Top independent B2B [Industry] in [Geography] 'Contact Us' OR 'Our Team'").
  → WARNING: DO NOT append '-site:' operators to your query.
2. [SCAN]: Call 'explore_website_structure' on promising targets to get a map of their DOM elements and sublinks.
3. [INSPECT]: Call 'read_html_component' on high-value layout blocks (e.g., 'footer', '#contact') or call 'explore_website_structure' on a promising sublink (e.g., /about-us) to find names and emails.
4. [SYNTHESIZE]: Apply The Synthesis Protocol to merge fragmented data into master personas.
5. [EXFILTRATE]: Call 'save_company' with the payload, INCLUDING all surviving unmerged fragments. Do this IMMEDIATELY once a domain yields valid insight.
6. [PIVOT]: If queries yield no new domains, call 'refine_search_strategy' to dynamically pivot your vectors.

Tools Available: [search_companies, explore_website_structure, read_html_component, save_company, refine_search_strategy]

EXECUTE VARUNA INTELLIGENCE PROTOCOL.`;

  if (isResume) {
    systemPrompt += `\nRESUME: Already consumed ${contactsSaved} credits out of ${maxCredits}. Need to find more leads until budget is reached. Previous queries: ${initialState?.queryTemplates?.join(", ") || "None"}. Use NEW queries.`;
  }

  // Start with a User message; pass systemPrompt via the 'system' option in generateText
  const messages: ModelMessage[] = [
    {
      role: "user",
      content: `Find ICP-matching companies until your budget of ${maxCredits} credits is reached. Start by searching, scan promising sites, then read their footer/contact HTML blocks to find real humans and emails. Go.`
    }
  ];

  const maxIterations = 50; // Prevent infinite loops
  const context = { jobId, poolId, logs: [] as any[], icp, userId, teamId, domCache: {} as Record<string, any> };
  let noProgressStreak = 0;
  let prevCompaniesSaved = 0;
  let prevContactsSaved = 0;
  const STALL_THRESHOLD = 5;
  const exhaustedDomains = new Set<string>();

  // Buffer logs locally to reduce DB write conflicts
  let logBuffer: Array<{ ts: string; msg: string; level?: string }> = [];
  let lastDbUpdate = Date.now();
  const DB_UPDATE_INTERVAL = 3000; // Only update DB every 3 seconds

  // Helper to add log to buffer
  const addLog = (logMsg: string, level?: string) => {
    const entry = { ts: new Date().toISOString(), msg: logMsg, level };
    logBuffer.push(entry);
    context.logs.push(entry as any);
    console.log(logMsg); // Always log to console
  };

  // Helper to flush logs to database with retry logic
  const flushLogsToDb = async (force: boolean = false, retries: number = 5) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastDbUpdate;

    // Only update if forced OR enough time has passed OR buffer is large
    if (!force && timeSinceLastUpdate < DB_UPDATE_INTERVAL && logBuffer.length < 10) {
      return;
    }

    if (logBuffer.length === 0 && !force) {
      return;
    }

    const updateData: any = {
      logs: context.logs,
      counters: {
        targetCredits: maxCredits,
        companiesFound: companiesSaved,
        contactsSaved,
        contactsCreated: contactsSaved,
        agentIterations: iterations,
        iterations,
        tokensUsed: accumulatedTokens,
        promptTokens: accumulatedPromptTokens,
        completionTokens: accumulatedCompletionTokens,
        tokenHistory,
        aiModel: modelId,
        progress: Math.min(100, Math.round((contactsSaved / maxCredits) * 100))
      }
    };

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await db.crm_Lead_Gen_Jobs.update({
          where: { id: jobId },
          data: updateData
        });

        // Success - clear the buffer and update timestamp
        logBuffer = [];
        lastDbUpdate = now;
        return;
      } catch (error: any) {
        if (error.code === 'P2034' && attempt < retries - 1) {
          // Write conflict - wait with exponential backoff (longer delays)
          const delay = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
        } else if (attempt === retries - 1) {
          // Last attempt failed, log but don't crash
          console.error("Failed to flush logs after retries:", error);
          // Don't clear buffer in case we can retry later
        } else {
          throw error; // Different error, re-throw
        }
      }
    }
  };

  // Log agent start
  addLog("🤖 Agentic AI scraper starting...");
  await flushLogsToDb(true); // Force initial update

  while (iterations < maxIterations && contactsSaved < maxCredits) {
    iterations++;

    // Check if job has been paused or stopped
    try {
      const currentJob = await db.crm_Lead_Gen_Jobs.findUnique({
        where: { id: jobId },
        select: { status: true }
      });

      if (currentJob?.status === "PAUSED") {
        addLog("⏸️ Job paused - waiting for resume...");
        await flushLogsToDb(true);

        // Wait and check again
        while (true) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds

          const checkJob = await db.crm_Lead_Gen_Jobs.findUnique({
            where: { id: jobId },
            select: { status: true }
          });

          if (checkJob?.status === "RUNNING") {
            addLog("▶️ Job resumed - continuing...");
            await flushLogsToDb(true);
            break;
          } else if (checkJob?.status === "STOPPED") {
            addLog("⏹️ Job stopped by user - exiting");
            await flushLogsToDb(true);
            return {
              companiesSaved,
              contactsSaved,
              accountsWithContactInfoSaved,
              iterations
            };
          }
        }
      } else if (currentJob?.status === "STOPPED") {
        addLog("⏹️ Job stopped by user - exiting");
        await flushLogsToDb(true);
        return {
          companiesSaved,
          contactsSaved,
          accountsWithContactInfoSaved,
          iterations
        };
      }
    } catch (statusCheckError) {
      console.error("Failed to check job status:", statusCheckError);
      // Continue anyway - don't crash on status check
    }

    try {
      // Stateful Memory Compaction — Instead of brutally slicing and causing amnesia,
      // we retain the ENTIRE message history but aggressively truncate the massive HTML 
      // payloads from old 'read_html_component' tool results to strictly control token growth.
      
      const KEEP_RAW_PAIRS = 2; // Keep raw HTML for only the last 2 iterations
      const rawThresholdIdx = Math.max(1, messages.length - (KEEP_RAW_PAIRS * 2));
      
      let compactedMessages = messages.map((msg, idx) => {
        // Only compact old messages, and specifically only 'tool' role messages
        if (idx >= rawThresholdIdx || msg.role !== 'tool' || !Array.isArray(msg.content)) {
          return msg;
        }

        // Deep clone to avoid mutating the original message array
        const clonedContent = msg.content.map((c: any) => {
          if (c.type === 'tool-result' && c.toolName === 'read_html_component' && typeof c.result === 'object' && c.result?.textPayload) {
            return {
              ...c,
              result: {
                ...c.result,
                textPayload: "[HTML TRUNCATED FOR MEMORY COMPACTION. You have already processed this target.]"
              }
            };
          }
          return c;
        });

        return { ...msg, content: clonedContent };
      });
      
      // We still insert the global progress override to act as a system boundary
      let windowedMessages = compactedMessages;
      if (windowedMessages.length > 1) {
        windowedMessages = [
          windowedMessages[0],
          {
            role: "user" as const,
            content: `[PROGRESS] Consumed ${contactsSaved}/${maxCredits} credits. Current totals: ${companiesSaved} companies, ${contactsSaved} contacts, ${iterations - 1} iterations. Ensure you clear your queue of found targets.`
          },
          ...windowedMessages.slice(1)
        ];
      }

      const tools = buildToolsDefinition(context);
      const dynamicSystemPrompt = systemPrompt + `\n\n[LIVE PROGRESS]: Consumed ${contactsSaved}/${maxCredits} credits. Current totals: ${companiesSaved} companies, ${contactsSaved} contacts, ${iterations - 1} iterations.\n[EXHAUSTED DOMAINS]: ${exhaustedDomains.size > 0 ? Array.from(exhaustedDomains).join(', ') : 'None yet'}. DO NOT search for or visit these domains again. They are fully exhausted.`;
      const genOpts: any = {
        model,
        system: dynamicSystemPrompt,
        messages: windowedMessages,
        tools,
      };
      // Only set temperature for non-reasoning models; omit entirely otherwise
      if (!isReasoningModel(model.modelId)) {
        genOpts.temperature = 1;
      }
      const { text, toolCalls, response, toolResults, usage } = await generateText(genOpts);

      // Track AI token usage
      if (usage) {
        const usageAny = usage as any;
        // Different providers use different property names:
        // OpenAI/Anthropic: promptTokens, completionTokens
        // Bedrock: inputTokens, outputTokens
        // Some: prompt_tokens, completion_tokens
        const pTok = usageAny.promptTokens || usageAny.inputTokens || usageAny.prompt_tokens || 0;
        const cTok = usageAny.completionTokens || usageAny.outputTokens || usageAny.completion_tokens || 0;
        const totalTok = usageAny.totalTokens || usageAny.total_tokens || (pTok + cTok);
        // If we got a total but no split, estimate based on typical tool-calling ratio
        const effectivePrompt = pTok > 0 ? pTok : (cTok > 0 ? 0 : Math.round(totalTok * 0.7));
        const effectiveCompletion = cTok > 0 ? cTok : (pTok > 0 ? 0 : totalTok - effectivePrompt);
        accumulatedTokens += totalTok;
        accumulatedPromptTokens += effectivePrompt;
        accumulatedCompletionTokens += effectiveCompletion;
        tokenHistory.push({ p: effectivePrompt, c: effectiveCompletion, t: totalTok });
        console.log(`[LEADGEN_DEBUG] Iteration ${iterations}: +${totalTok} tokens (prompt=${effectivePrompt}, completion=${effectiveCompletion}, total=${accumulatedTokens} [P:${accumulatedPromptTokens} C:${accumulatedCompletionTokens}]) [raw keys: ${Object.keys(usageAny).join(',')}]`);

        // Log to AI Usage audit in real-time (non-blocking)
        if (teamId && totalTok > 0) {
          try {
            await logAiUsage({
              teamId,
              userId: userId || null,
              service: "leadgen",
              model: `${provider}:${modelId}`,
              usage: {
                promptTokens: effectivePrompt,
                completionTokens: effectiveCompletion,
              },
              description: `Lead gen iteration ${iterations} (job: ${jobId.slice(0, 8)})`,
            });
          } catch (usageErr: any) {
            if (usageErr?.message?.includes('Insufficient AI tokens')) {
              addLog(`🚫 AI token balance exhausted. ${companiesSaved} companies saved. Please top up your AI credits to continue.`, "ERROR");
              await db.crm_Lead_Gen_Jobs.update({
                where: { id: jobId },
                data: {
                  status: "FAILED",
                  finishedAt: new Date(),
                  counters: {
                    targetCredits: maxCredits,
                    companiesFound: companiesSaved,
                    contactsSaved,
                    contactsCreated: contactsSaved,
                    agentIterations: iterations,
                    iterations,
                    tokensUsed: accumulatedTokens,
                    promptTokens: accumulatedPromptTokens,
                    completionTokens: accumulatedCompletionTokens,
                    tokenHistory,
                    progress: Math.min(100, Math.round((contactsSaved / maxCredits) * 100)),
                    failReason: "INSUFFICIENT_AI_TOKENS"
                  }
                }
              });
              await flushLogsToDb(true);
              return { companiesSaved, contactsSaved, accountsWithContactInfoSaved, iterations };
            }
            console.error("[LEADGEN_ITER_LOG]", usageErr);
          }
        }
      } else {
        console.warn(`[LEADGEN_DEBUG] Iteration ${iterations}: NO usage object returned from generateText!`);
      }

      // Check if agent wants to use tools
      if (toolCalls && toolCalls.length > 0) {
        const toolCount = toolCalls.length;

        // Append assistant message with tool-call parts (explicit ModelMessage shape)
        // Use SDK-generated assistant/tool messages to ensure exact v5 shapes
        if (response?.messages && Array.isArray(response.messages)) {
          messages.push(...(response.messages as unknown as ModelMessage[]));
        }

        // Logging for visibility
        toolCalls.forEach((tc: any, index: number) => {
          const toolName = tc.toolName;
          const toolArgs = tc.input ?? {};
          let logMsg = "";
          switch (toolName) {
            case "search_companies":
              logMsg = `🔍[${index + 1}/${toolCount}]Searching: "${(toolArgs as any).query}"`;
              break;
            case "visit_website":
              const urlDomain = extractDomain((toolArgs as any).url);
              if (urlDomain) exhaustedDomains.add(urlDomain);
              logMsg = `🌐[${index + 1}/${toolCount}] Visiting: ${urlDomain || (toolArgs as any).url} `;
              break;
            case "analyze_company_fit":
              logMsg = `🔬[${index + 1}/${toolCount}] Analyzing: ${(toolArgs as any).domain} `;
              break;
            case "save_company":
              if ((toolArgs as any).domain) exhaustedDomains.add((toolArgs as any).domain);
              logMsg = `💾[${index + 1}/${toolCount}] Saving: ${(toolArgs as any).companyName || (toolArgs as any).domain} `;
              break;
            case "refine_search_strategy":
              logMsg = `🎯[${index + 1}/${toolCount}] Strategy: ${(toolArgs as any).reasoning?.substring(0, 100) ?? ''}...`;
              break;
            default:
              logMsg = `🤖[${index + 1}/${toolCount}] ${toolName} `;
          }
          addLog(logMsg);
        });

        // Track saves and summarize using toolResults
        const savedResults = (toolResults ?? []).filter((tr: any) => {
          if (tr.toolName !== "save_company") return false;
          const out = (tr as any).result || (tr as any).output;
          if (!out) return false;
          if (typeof out === 'object' && 'type' in out) {
            if (out.type === 'json' && out.value && typeof out.value === 'object') {
              return !!out.value.success;
            }
            if (out.type === 'text') {
              try { const obj = JSON.parse(out.value); return !!obj.success; } catch { return false; }
            }
            return false;
          }
          // Fallback if provider returned plain object
          return !!(out as any).success;
        });
        let batchCost = 0;
        for (const tr of savedResults) {
          const out = (tr as any).result || (tr as any).output;
          let accountValid = false;
          let contactsC = 0;
          if (typeof out === 'object' && 'type' in out) {
            if (out.type === 'json' && out.value) {
              accountValid = !!out.value.accountHasContactInfo;
              contactsC = out.value.contactInfoCredits || out.value.contactsCreated || 0;
            }
          } else {
            accountValid = !!(out as any)?.accountHasContactInfo;
            contactsC = (out as any)?.contactInfoCredits || (out as any)?.contactsCreated || 0;
          }

          // No longer double-billing for the account if it shares the same contact info
          batchCost += contactsC;
          companiesSaved++;
          contactsSaved += contactsC;
          if (accountValid) accountsWithContactInfoSaved++;
        }

        // DYNAMICAL CREDIT DEDUCTION
        if (batchCost > 0 && teamId) {
          try {
            const { consumeLeadGenCredits } = await import("@/lib/scraper/credits");
            await consumeLeadGenCredits(teamId, batchCost);

            // Gamification hook: 1 Raw XP awarded per credit consumed
            if (userId) {
              import("@/actions/quests/add-raw-xp")
                .then((m) => m.addRawXP({ userId, xpAmount: batchCost, reason: "Lead Gen Credits" }))
                .catch((e) => console.warn(`[AGENTIC_LEADGEN] Failed to award XP: ${e?.message}`));
            }
          } catch (billingErr: any) {
            addLog(`🚫 Lead Gen credits dynamically exhausted mid-run. Stopping agent.`, "ERROR");
            await flushLogsToDb(false);
            // Halt loop implicitly by maxing out accounts (safe exit path handles writes)
            accountsWithContactInfoSaved = maxCredits;
            contactsSaved = maxCredits;
          }
        }

        let summary = `✅ Batch complete: ${toolCount} tool call${toolCount > 1 ? 's' : ''} `;
        if (savedResults.length > 0) summary += ` | ${savedResults.length} saved`;
        summary += ` | Total: ${contactsSaved}/${maxCredits} credits consumed (${companiesSaved} companies & ${contactsSaved} contacts | ${accountsWithContactInfoSaved} valid accounts)`;
        addLog(summary);

        // Detect SERP skip/no results towards stall completion
        let __serpZero = false;
        try {
          for (const tr of (toolResults ?? [])) {
            if (tr.toolName !== 'search_companies') continue;
            let payload: any = tr.output;
            if (payload && typeof payload === 'object' && 'type' in payload) {
              if (payload.type === 'json') payload = payload.value;
              else if (payload.type === 'text') {
                try { payload = JSON.parse(payload.value); } catch { /* ignore */ }
              }
            }
            const cnt = typeof payload?.count === 'number' ? payload.count : (Array.isArray(payload?.results) ? payload.results.length : 0);
            if (cnt === 0) { __serpZero = true; break; }
          }
        } catch { }
        if (__serpZero && savedResults.length === 0) {
          addLog('SERP returned 0 results and no companies were saved in this batch. Refining strategy and continuing.');
          messages.push({
            role: 'user',
            content: 'SERP returned zero results. Refine and continue: diversify queries (synonyms, broader/narrower), broaden geos, include directories (LinkedIn, Crunchbase, ProductHunt), and prioritize /about, /team, /contact pages.'
          });
          noProgressStreak = 0;
        }

        // Explicitly echo search_companies results back into the conversation for the model
        try {
          const callMap = new Map((toolCalls ?? []).map((tc: any) => [tc.toolCallId, tc.input ?? {}]));
          const searchSummaries: string[] = [];
          for (const tr of (toolResults ?? [])) {
            if (tr.toolName !== 'search_companies') continue;
            const input = callMap.get(tr.toolCallId) || {};
            const query = (input as any).query || '(unknown query)';
            let payload: any = tr.output;
            if (payload && typeof payload === 'object' && 'type' in payload) {
              if (payload.type === 'json') payload = payload.value;
              else if (payload.type === 'text') { try { payload = JSON.parse(payload.value); } catch { /* ignore */ } }
            }
            const results = Array.isArray(payload?.results) ? payload.results : [];
            const count = typeof payload?.count === 'number' ? payload.count : results.length;
            const topDomains = results.slice(0, 5).map((r: any) => r.domain || (r.url ? extractDomain(r.url) : '')).filter(Boolean);
            searchSummaries.push(`- Query: "${query}" -> ${count} result(s). Top domains: ${topDomains.join(', ') || 'none'}`);
            addLog(`🔎 Search summary: "${query}" -> ${count} result(s)`);
          }
          if (searchSummaries.length > 0) {
            messages.push({
              role: 'user',
              content: `Search results received and summarized for the agent:\n${searchSummaries.join('\n')}`
            });
          }
        } catch (e) {
          addLog(`⚠️ Failed to echo search results to conversation: ${(e as Error).message}`);
        }

        await flushLogsToDb(false);
        // Progress stall detection
        if (companiesSaved === prevCompaniesSaved && contactsSaved === prevContactsSaved) {
          noProgressStreak++;
        } else {
          noProgressStreak = 0;
          prevCompaniesSaved = companiesSaved;
          prevContactsSaved = contactsSaved;
        }
        if (noProgressStreak >= STALL_THRESHOLD) {
          addLog(`No progress for ${STALL_THRESHOLD} consecutive iterations. Refining search strategy and continuing.`);
          messages.push({
            role: 'user',
            content: 'No progress detected. Refine search now: diversify queries (synonyms, broader/narrower), broaden geos, include directories (LinkedIn, Crunchbase, ProductHunt), and prioritize /about, /team, /contact pages before continuing.'
          });
          noProgressStreak = 0;
        }
      } else if (text) {
        // Agent is thinking/reasoning (text response without tools)
        // Add assistant message to history
        messages.push({
          role: "assistant",
          content: text,
        });

        console.log("Agent reasoning:", text);
        addLog(`💭 Agent thinking: ${text}`);

        // Check if agent thinks it's complete
        if (text.toLowerCase().includes("complete") ||
          text.toLowerCase().includes("finished") ||
          contactsSaved >= maxCredits) {
          addLog("✅ Agent believes task is complete or budget was reached");
          await flushLogsToDb(true); // Force flush
          break;
        }

        // Add a user message to keep it going with more direct instructions
        if (contactsSaved < maxCredits) {
          messages.push({
            role: "user",
            content: `${contactsSaved}/${maxCredits} credits consumed. ${companiesSaved === 0 ? 'Save companies you found now! ' : ''}Continue: search → visit → save_company (ALL contacts).`
          });
          addLog(`📍 Checkpoint: ${contactsSaved}/${maxCredits} credits | Directing agent to save...`);
          await flushLogsToDb(false); // Opportunistic flush
          // Progress stall detection
          if (companiesSaved === prevCompaniesSaved && contactsSaved === prevContactsSaved) {
            noProgressStreak++;
          } else {
            noProgressStreak = 0;
            prevCompaniesSaved = companiesSaved;
            prevContactsSaved = contactsSaved;
          }
          if (noProgressStreak >= STALL_THRESHOLD) {
            addLog(`No progress for ${STALL_THRESHOLD} consecutive iterations. Refining search strategy and continuing.`);
            messages.push({
              role: 'user',
              content: 'No progress detected. Refine search now: diversify queries (synonyms, broader/narrower), broaden geos, include directories (LinkedIn, Crunchbase, ProductHunt), and prioritize /about, /team, /contact pages before continuing.'
            });
            noProgressStreak = 0;
          }
        }
      }

      // Safety: Add delay between iterations
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      const errMsg = (error as Error).message || String(error);
      console.error("Agent iteration error:", error);
      addLog(`Agent error (attempt): ${errMsg}`, "ERROR");

      // Retry up to 2 more times with backoff before giving up
      let recovered = false;
      for (let retry = 1; retry <= 2; retry++) {
        addLog(`🔄 Retrying AI call (${retry}/2) after ${retry * 3}s...`);
        await new Promise(resolve => setTimeout(resolve, retry * 3000));
        try {
          // Re-resolve model in case of transient credential issues
          const retryResult = await getAiSdkModel({ userId, teamId: teamId || undefined }, "enrichment");
          if (retryResult.model) {
            addLog(`✅ AI model reconnected on retry ${retry}. Continuing.`);
            recovered = true;
            break;
          }
        } catch (retryErr) {
          addLog(`❌ Retry ${retry} failed: ${(retryErr as Error).message}`, "ERROR");
        }
      }

      if (!recovered) {
        addLog(`🚫 AI model failed after all retries. Last error: ${errMsg}`, "ERROR");
        await flushLogsToDb(true);
        break;
      }
      await flushLogsToDb(true);
    }
  }

  // Log completion
  addLog(`🤖 Agent complete: ${companiesSaved} companies, ${contactsSaved} contacts in ${iterations} iterations (${accumulatedTokens.toLocaleString()} tokens: ${accumulatedPromptTokens.toLocaleString()} prompt + ${accumulatedCompletionTokens.toLocaleString()} completion)`);
  await flushLogsToDb(true); // Force final flush

  // Token logging already handled per-iteration above — just log summary
  if (teamId && accumulatedTokens > 0) {
    console.log(`[LEADGEN_TOKENS] Total: ${accumulatedTokens} tokens for team ${teamId} (logged per-iteration)`);
  }
  // If we produced 0 companies, mark as FAILED so the user can see what went wrong
  const finalStatus = companiesSaved > 0 ? "SUCCESS" : "FAILED";
  const lastErrorLog = context.logs.filter((l: any) => l.level === "ERROR").pop();
  try {
    await db.crm_Lead_Gen_Jobs.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        counters: {
          companiesFound: companiesSaved,
          contactsSaved,
          contactsCreated: contactsSaved,
          agentIterations: iterations,
          iterations,
          tokensUsed: accumulatedTokens,
          promptTokens: accumulatedPromptTokens,
          completionTokens: accumulatedCompletionTokens,
          tokenHistory,
          progress: companiesSaved > 0 ? 100 : 0,
          ...(finalStatus === "FAILED" && lastErrorLog ? { failReason: lastErrorLog.msg } : {})
        }
      }
    });
    console.log(`[LEADGEN] Final write ${finalStatus}: tokensUsed=${accumulatedTokens}, companies=${companiesSaved}`);
  } catch (err) {
    console.error("[LEADGEN] FINAL WRITE FAILED:", err);
  }

  return {
    companiesSaved,
    contactsSaved,
    accountsWithContactInfoSaved,
    iterations
  };
}

