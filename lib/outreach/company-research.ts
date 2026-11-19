/**
 * Lightweight company research for outreach emails
 * Extracts domain from lead email, scrapes website for context,
 * falls back to DuckDuckGo instant answer API (like vcrun.py)
 */

import { systemLogger } from "@/lib/logger";
import { safeFetch } from "@/lib/security/ssrf-guard";

/**
 * Extract domain from an email address
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || !email.includes("@")) return null;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  // Skip common free email providers
  const freeProviders = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
    "icloud.com", "mail.com", "protonmail.com", "me.com", "live.com",
    "msn.com", "ymail.com", "zoho.com", "pm.me", "hey.com",
  ];
  if (!domain || freeProviders.includes(domain)) return null;
  return domain;
}

/**
 * Scrape basic company info from a website URL
 * Uses simple fetch + regex parsing (no Puppeteer — too heavy for real-time)
 */
async function scrapeWebsite(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await safeFetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const infoParts: string[] = [];

    // Extract meta description
    const metaDescMatch = html.match(/<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']{10,})["']/i)
      || html.match(/<meta\s[^>]*content=["']([^"']{10,})["'][^>]*name=["']description["']/i);
    if (metaDescMatch?.[1]) {
      infoParts.push(metaDescMatch[1].trim());
    }

    // Extract og:description
    const ogDescMatch = html.match(/<meta\s[^>]*property=["']og:description["'][^>]*content=["']([^"']{10,})["']/i)
      || html.match(/<meta\s[^>]*content=["']([^"']{10,})["'][^>]*property=["']og:description["']/i);
    if (ogDescMatch?.[1]) {
      const ogDesc = ogDescMatch[1].trim();
      if (!infoParts.includes(ogDesc)) infoParts.push(ogDesc);
    }

    // Strip HTML tags helper
    const stripTags = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

    // Extract meaningful paragraphs (skip nav, footer, script, style content)
    const cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "");

    // Get paragraphs
    const pMatches = Array.from(cleanHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi));
    for (const m of pMatches) {
      if (infoParts.length >= 3) break;
      const text = stripTags(m[1]);
      if (
        text.length > 80 &&
        !text.toLowerCase().includes("cookie") &&
        !text.toLowerCase().includes("privacy") &&
        !text.toLowerCase().includes("copyright") &&
        !infoParts.includes(text)
      ) {
        infoParts.push(text);
      }
    }

    if (infoParts.length === 0) return null;

    // Combine and limit to ~600 chars
    let combined = infoParts.slice(0, 3).join(" ");
    if (combined.length > 600) combined = combined.substring(0, 597) + "...";
    return combined;
  } catch (err: any) {
    systemLogger.warn(`[COMPANY_RESEARCH] Scrape failed for ${url}: ${err?.message || "timeout"}`);
    return null;
  }
}

/**
 * Search DuckDuckGo Instant Answer API for company info
 * Mirrors vcrun.py's lookup_company_info() approach
 */
async function searchDuckDuckGo(query: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const encodedQuery = encodeURIComponent(query);
    const url = `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const parts: string[] = [];

    if (data.AbstractText) {
      parts.push(data.AbstractText);
    }
    if (data.Abstract && data.Abstract !== data.AbstractText) {
      parts.push(data.Abstract);
    }

    // Get related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 2)) {
        if (topic && typeof topic === "object" && topic.Text) {
          parts.push(topic.Text);
        }
      }
    }

    if (parts.length === 0) return null;

    let combined = parts.slice(0, 2).join(" ");
    if (combined.length > 600) combined = combined.substring(0, 597) + "...";
    systemLogger.info(`[COMPANY_RESEARCH] DDG found ${combined.length} chars for "${query}"`);
    return combined;
  } catch (err: any) {
    systemLogger.warn(`[COMPANY_RESEARCH] DDG search failed for "${query}": ${err?.message || "timeout"}`);
    return null;
  }
}

/**
 * Research a lead's company based on their email domain
 * Returns a plain-text summary suitable for AI prompting
 *
 * Strategy (mirrors vcrun.py):
 * 1. Direct website scrape (https, www, http)
 * 2. DuckDuckGo instant answer API with company name
 * 3. DuckDuckGo with just domain name
 * 4. Fallback: domain-based minimal context
 */
export async function researchCompany(email: string): Promise<string | null> {
  const domain = extractDomainFromEmail(email);
  if (!domain) return null;

  const companyName = domain.split(".")[0];

  systemLogger.info(`[COMPANY_RESEARCH] Researching domain: ${domain}`);

  // 1. Try direct website scrape
  const urls = [
    `https://${domain}`,
    `https://www.${domain}`,
    `http://${domain}`,
  ];

  for (const url of urls) {
    const result = await scrapeWebsite(url);
    if (result) {
      systemLogger.info(`[COMPANY_RESEARCH] Found ${result.length} chars from ${url}`);
      return result;
    }
  }

  // 2. Try DuckDuckGo with company name
  systemLogger.info(`[COMPANY_RESEARCH] Website scrape failed, trying DuckDuckGo for "${companyName}"`);
  const ddgResult = await searchDuckDuckGo(`${companyName} company`);
  if (ddgResult) return ddgResult;

  // 3. Try DuckDuckGo with full domain
  const ddgDomainResult = await searchDuckDuckGo(domain);
  if (ddgDomainResult) return ddgDomainResult;

  // 4. Fallback: domain-based context
  systemLogger.info(`[COMPANY_RESEARCH] No info found, using domain fallback for ${domain}`);
  return `Company at ${domain} (${companyName})`;
}
