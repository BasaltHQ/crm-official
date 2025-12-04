/**
 * Agentic AI Lead Scraper - The World's Most Powerful
 * Uses GPT-5/GPT-4 with function calling to autonomously:
 * - Search for companies (Bing API)
 * - Visit and analyze websites
 * - Extract contacts intelligently
 * - Refine search strategy based on results
 */

import { openAiHelper } from "@/lib/openai";
import { prismadbCrm } from "@/lib/prisma-crm";
import { launchBrowser, newPageWithDefaults, closeBrowser } from "@/lib/browser";
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
 * DuckDuckGo search using browser automation (free, no API needed)
 */
async function ddgWebSearch(query: string, count: number = 20): Promise<Array<{
  name: string;
  url: string;
  snippet: string;
  domain: string;
}>> {
  const browser = await launchBrowser();
  try {
    const page = await newPageWithDefaults(browser);
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const results = await page.evaluate(() => {
      const extracted: Array<{ name: string; url: string; snippet: string }> = [];

      const links = document.querySelectorAll('a[href*="http"]');
      links.forEach((link, idx) => {
        if (idx < 25) {
          const anchor = link as HTMLAnchorElement;
          const href = anchor.href;
          if (href && !href.includes('duckduckgo.com') &&
            (href.startsWith('http://') || href.startsWith('https://'))) {
            extracted.push({
              name: (anchor.textContent || '').trim(),
              url: href,
              snippet: (anchor.closest('.result')?.textContent || '').substring(0, 200)
            });
          }
        }
      });

      return extracted;
    });

    return results.map(r => ({
      ...r,
      domain: extractDomain(r.url)
    })).filter(r => r.domain);
  } catch (error) {
    console.error("DDG search error:", error);
    return [];
  } finally {
    await closeBrowser(browser);
  }
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

/**
 * AI Agent Tools - These are callable by the AI
 */
const agentTools = [
  {
    type: "function",
    function: {
      name: "search_companies",
      description: "Search for companies using Bing Search API. Returns company websites matching the query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find companies (e.g., 'SaaS companies in San Francisco')"
          },
          count: {
            type: "number",
            description: "Number of results to return (1-50)",
            default: 20
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "visit_website",
      description: "Visit a company website and extract all available information including company details and contact information.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to visit"
          }
        },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_company_fit",
      description: "Analyze if a company matches the ICP criteria and should be added to the pool.",
      parameters: {
        type: "object",
        properties: {
          domain: {
            type: "string",
            description: "Company domain"
          },
          companyData: {
            type: "object",
            description: "Company information extracted from website"
          }
        },
        required: ["domain", "companyData"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_company",
      description: "Save a qualified company to the lead pool with extracted data.",
      parameters: {
        type: "object",
        properties: {
          domain: {
            type: "string"
          },
          companyName: {
            type: "string"
          },
          description: {
            type: "string"
          },
          industry: {
            type: "string"
          },
          techStack: {
            type: "array",
            items: { type: "string" }
          },
          contacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                title: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                linkedin: { type: "string" }
              }
            }
          }
        },
        required: ["domain"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "refine_search_strategy",
      description: "Based on results so far, decide if search strategy should be adjusted.",
      parameters: {
        type: "object",
        properties: {
          currentResults: {
            type: "number",
            description: "Number of qualified companies found so far"
          },
          targetResults: {
            type: "number",
            description: "Target number of companies"
          },
          reasoning: {
            type: "string",
            description: "Why the strategy should or shouldn't change"
          }
        },
        required: ["currentResults", "targetResults", "reasoning"]
      }
    }
  }
];

/**
 * Discover sitemap URLs from a domain
 */
async function discoverSitemap(domain: string, page: any): Promise<string[]> {
  const sitemapUrls: string[] = [];
  const baseUrl = `https://${domain}`;
  
  try {
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
      
      // Remove overlay elements that might block content
      const overlaySelectors = [
        '[class*="cookie-banner"]',
        '[class*="cookie-notice"]',
        '[class*="gdpr"]',
        '[id*="cookie"]',
        '[class*="overlay"][style*="fixed"]',
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
}> {
  return page.evaluate(() => {
    const result: any = {
      title: document.title,
      description: "",
      emails: [],
      phones: [],
      socialLinks: {},
      techStack: [],
      internalLinks: []
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
    
    // Tech stack detection - expanded
    const html = document.documentElement.outerHTML.toLowerCase();
    const techIndicators: { [key: string]: string[] } = {
      'React': ['react', '_reactroot', '__react'],
      'Vue.js': ['vue', '__vue__'],
      'Angular': ['ng-app', 'ng-version', 'angular'],
      'WordPress': ['wp-content', 'wordpress'],
      'Shopify': ['shopify', 'cdn.shopify'],
      'Next.js': ['__next', '_next/static'],
      'Gatsby': ['gatsby', '___gatsby'],
      'Laravel': ['laravel'],
      'Ruby on Rails': ['rails', 'turbolinks'],
      'Django': ['csrfmiddlewaretoken', 'django'],
      'HubSpot': ['hubspot', 'hs-script'],
      'Salesforce': ['salesforce', 'pardot'],
      'Marketo': ['marketo', 'munchkin'],
      'Intercom': ['intercom'],
      'Zendesk': ['zendesk'],
      'Drift': ['drift'],
    };
    
    Object.entries(techIndicators).forEach(([tech, indicators]) => {
      for (const indicator of indicators) {
        if (html.includes(indicator)) {
          result.techStack.push(tech);
          break;
        }
      }
    });
    
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
    
    return result;
  });
}

/**
 * Visit website with deep crawling - visits multiple pages for maximum contact extraction
 */
async function visitWebsiteForAgent(url: string): Promise<any> {
  const browser = await launchBrowser();
  try {
    const page = await newPageWithDefaults(browser);
    const domain = extractDomain(url);
    
    // Aggregate data from all pages
    const aggregatedData: any = {
      title: "",
      description: "",
      contacts: [],
      socialLinks: {},
      techStack: [],
      emails: [],
      phones: [],
      pagesVisited: [],
      errors: []
    };
    
    // Step 1: Visit homepage
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 1500));
      await dismissOverlays(page);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const homeData = await extractPageData(page);
      aggregatedData.title = homeData.title;
      aggregatedData.description = homeData.description;
      aggregatedData.emails.push(...homeData.emails);
      aggregatedData.phones.push(...homeData.phones);
      aggregatedData.techStack.push(...homeData.techStack);
      Object.assign(aggregatedData.socialLinks, homeData.socialLinks);
      aggregatedData.pagesVisited.push(url);
    } catch (e) {
      aggregatedData.errors.push(`Homepage: ${(e as Error).message}`);
    }
    
    // Step 2: Discover sitemap
    const sitemapUrls = await discoverSitemap(domain, page);
    
    // Step 3: Get high-value page URLs
    const highValueUrls = getHighValuePageUrls(domain, sitemapUrls);
    
    // Step 4: Visit high-value pages (limit to 5 for performance)
    const pagesToVisit = highValueUrls
      .filter(u => !aggregatedData.pagesVisited.includes(u))
      .slice(0, 5);
    
    for (const pageUrl of pagesToVisit) {
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 12000 });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await dismissOverlays(page);
        
        const pageData = await extractPageData(page);
        aggregatedData.emails.push(...pageData.emails);
        aggregatedData.phones.push(...pageData.phones);
        aggregatedData.techStack.push(...pageData.techStack);
        Object.assign(aggregatedData.socialLinks, pageData.socialLinks);
        aggregatedData.pagesVisited.push(pageUrl);
      } catch (e) {
        // Page failed to load, continue to next
        aggregatedData.errors.push(`${pageUrl}: ${(e as Error).message}`);
      }
    }
    
    // Deduplicate results
    aggregatedData.emails = Array.from(new Set(aggregatedData.emails as string[]));
    aggregatedData.phones = Array.from(new Set(aggregatedData.phones as string[]));
    aggregatedData.techStack = Array.from(new Set(aggregatedData.techStack as string[]));
    
    return aggregatedData;
  } catch (error) {
    return { error: (error as Error).message };
  } finally {
    await closeBrowser(browser);
  }
}

/**
 * Use AI to enrich missing company fields
 */
async function enrichCompanyDataWithAI(
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
    const openai = await openAiHelper(userId);
    if (!openai) {
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
1. companyName: The business name (extract from domain/title, make it professional)
2. description: A clear 1-2 sentence description of what this business does
3. industry: The primary industry (match to ICP industries if possible, otherwise be specific)

Return ONLY valid JSON:
{
  "companyName": "Professional Business Name",
  "description": "Clear description of what they do and their focus",
  "industry": "Specific Industry Category"
}`;

    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4";

    const response = await openai.chat.completions.create({
      model: deployment,
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing company websites and extracting structured business information. Return valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      // temperature: 0.3,
      // max_tokens: 300,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        companyName: parsed.companyName || domain,
        description: parsed.description || `Business website: ${domain}`,
        industry: parsed.industry || (icp.industries?.[0] || "General Business")
      };
    }
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
 */
async function executeToolCall(toolName: string, args: any, context: any): Promise<any> {
  switch (toolName) {
    case "search_companies":
      const searchResults = await ddgWebSearch(args.query, args.count || 20);
      return {
        success: true,
        results: searchResults,
        count: searchResults.length
      };

    case "visit_website":
      const siteData = await visitWebsiteForAgent(args.url);
      return {
        success: !siteData.error,
        data: siteData,
        url: args.url
      };

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

      // Validate: Must have at least one contact with email or phone
      if (!args.contacts || !Array.isArray(args.contacts) || args.contacts.length === 0) {
        console.log("[SAVE_COMPANY] Validation failed: No contacts");
        return { success: false, error: "Cannot save company without contacts" };
      }

      const contactsWithInfo = args.contacts.filter((c: any) =>
        (c.email && c.email.trim().length > 0) || (c.phone && c.phone.trim().length > 0)
      );
      console.log("[SAVE_COMPANY] Contacts with email or phone:", contactsWithInfo.length);

      if (contactsWithInfo.length === 0) {
        console.log("[SAVE_COMPANY] Validation failed: No contact info");
        return { success: false, error: "Cannot save company without at least one email or phone number" };
      }

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
        contactCount: contactsWithInfo.length
      });

      try {
        // Save to global index
        const dedupeKey = generateCompanyDedupeKey(domain);
        await db.crm_Global_Companies.upsert({
          where: { dedupeKey },
          create: {
            domain,
            dedupeKey,
            companyName,
            description,
            industry,
            techStack: args.techStack || [],
            firstSeen: new Date(),
            lastSeen: new Date(),
            status: "ACTIVE",
            provenance: { source: "agentic_ai", jobId: context.jobId }
          },
          update: {
            companyName,
            description,
            industry,
            techStack: args.techStack || [],
            lastSeen: new Date()
          }
        });

        // Calculate quality score based on data completeness
        // Base score starts at 50, add points for quality signals
        let qualityScore = 50;

        // +10 points for each contact found (up to +30)
        qualityScore += Math.min(contactsWithInfo.length * 10, 30);

        // +10 points if we have multiple emails
        const emailCount = args.contacts.filter((c: any) => c.email).length;
        if (emailCount >= 2) qualityScore += 10;

        // +5 points for tech stack
        if (args.techStack && args.techStack.length > 0) qualityScore += 5;

        // +5 points for complete company info
        if (description && description.length > 50) qualityScore += 5;

        // Cap at 95 (ICP scoring will adjust from there)
        qualityScore = Math.min(qualityScore, 95);

        // Save to user pool
        const candidate = await db.crm_Lead_Candidates.create({
          data: {
            pool: context.poolId,
            domain,
            dedupeKey,
            companyName,
            description,
            industry,
            techStack: args.techStack || [],
            homepageUrl: `https://${domain}`,
            score: qualityScore,
            status: "NEW",
            provenance: { source: "agentic_ai", jobId: context.jobId }
          }
        });

        // Save ALL contacts with emails or phones
        let contactsSavedCount = 0;
        if (args.contacts && Array.isArray(args.contacts)) {
          for (const contact of args.contacts) {
            const email = normalizeEmail(contact.email);
            const phone = normalizePhone(contact.phone);

            // Save contact if it has either email or phone
            if (email || phone) {
              // Build a safe display name using email/company/domain fallbacks (avoid "Direct Direct")
              const safeName = safeContactDisplayName(
                contact.name,
                email,
                companyName,
                domain
              );

              const personDedupeKey = generatePersonDedupeKey(
                email || phone || "",
                safeName,
                domain,
                contact.title
              );

              await db.crm_Contact_Candidates.create({
                data: {
                  leadCandidate: candidate.id,
                  fullName: normalizeName(safeName) || safeName,
                  title: contact.title || null,
                  email: email || null,
                  phone: phone || null,
                  linkedinUrl: contact.linkedin || null,
                  dedupeKey: personDedupeKey,
                  confidence: 70,
                  status: "NEW",
                  provenance: { source: "agentic_ai", jobId: context.jobId }
                }
              });
              contactsSavedCount++;
            }
          }
        }

        return {
          success: true,
          candidateId: candidate.id,
          contactsCreated: contactsSavedCount
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
  maxCompanies: number = 100
): Promise<{
  companiesSaved: number;
  contactsSaved: number;
  iterations: number;
}> {
  const openai = await openAiHelper(userId);
  if (!openai) {
    throw new Error("OpenAI not configured");
  }

  const db: any = prismadbCrm;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4";

  // Initial prompt for the agent
  const systemPrompt = `You are an ELITE B2B lead generation agent with world-class expertise in search, web scraping, and contact discovery. Your mission: autonomously find and qualify ${maxCompanies} PERFECT-FIT companies with ACTUAL decision-maker contact information.

ICP CRITERIA (Ideal Customer Profile):
- Industries: ${icp.industries?.join(", ") || "Any"}
- Geographies: ${icp.geos?.join(", ") || "Any"}
- Tech Stack: ${icp.techStack?.join(", ") || "Any"}
- Target Titles: ${icp.titles?.join(", ") || "Any"}
${icp.notes ? `- Additional Notes: ${icp.notes}` : ""}

TARGET: ${maxCompanies} companies with HIGH-QUALITY contact information

═══════════════════════════════════════════════════════
🎯 CRITICAL SUCCESS CRITERIA (READ CAREFULLY)
═══════════════════════════════════════════════════════

1. ⚠️ **EMAIL REQUIREMENT**: NEVER save a company without AT LEAST ONE email address
2. **MULTIPLE CONTACTS**: Extract ALL contacts from EVERY qualified company (aim for 3-5+ per company)
3. **VISIT MULTIPLE PAGES**: Don't stop at homepage - check /about, /team, /contact, /leadership
4. **PARALLEL EXECUTION**: Visit 5-10 websites simultaneously for speed
5. **QUALITY > SPEED**: Better to save 20 perfect companies than 100 with missing data

═══════════════════════════════════════════════════════
🔍 MASTER CONTACT EXTRACTION STRATEGIES
═══════════════════════════════════════════════════════

**WHERE TO FIND EMAILS (Priority Order):**

1. **Contact Pages** (domain.com/contact, /contact-us)
   - General inquiry emails (info@, contact@, hello@)
   - Department emails (sales@, support@, careers@)
   - Individual contact forms with emails

2. **Team/About Pages** (domain.com/team, /about, /about-us, /leadership)
   - Founder/CEO emails
   - Leadership team contacts
   - Employee bios with email addresses

3. **Footer & Header**
   - Company-wide contact emails
   - Support/sales emails
   - Press/media contact emails

4. **Careers Pages** (domain.com/careers, /jobs)
   - Recruiting emails
   - HR contact information
   - "Questions? Contact recruiter@..."

5. **Press/Media Pages** (domain.com/press, /media, /newsroom)
   - PR contact emails
   - Media inquiry addresses

6. **Blog/Articles** (domain.com/blog)
   - Author emails
   - Contact the editor emails

**ADVANCED TACTICS:**

- **Visit 3-5 pages per company minimum**: Homepage + Contact + Team + About + Careers
- **Look in page source**: Sometimes emails are in mailto: links or meta tags
- **Check subdomains**: blog.company.com, careers.company.com might have different contacts
- **Extract from text patterns**: Look for email patterns like firstname@domain.com
- **LinkedIn URLs**: Extract any LinkedIn profile URLs (useful even without email)
- **Phone numbers**: Extract all phone numbers as backup contact methods

═══════════════════════════════════════════════════════
🔎 DUCKDUCKGO SEARCH MASTERY
═══════════════════════════════════════════════════════

**EFFECTIVE QUERY PATTERNS:**

✓ Industry + Location:
  "${icp.industries?.[0] || 'SaaS'} companies in ${icp.geos?.[0] || 'San Francisco'}"
  
✓ Industry + Company Stage:
  "top ${icp.industries?.[0] || 'fintech'} startups ${icp.geos?.[0] || 'New York'}"
  "Series A ${icp.industries?.[0] || 'AI'} companies"
  
✓ Industry + Hiring (great for finding active companies):
  "${icp.industries?.[0] || 'tech'} companies hiring ${icp.titles?.[0] || 'engineers'}"
  "${icp.industries?.[0] || 'SaaS'} careers page"
  
✓ Technology-specific:
  "companies using ${icp.techStack?.[0] || 'React'}"
  "built with ${icp.techStack?.[0] || 'Node.js'}"

✓ Company directories (very effective):
  "site:crunchbase.com ${icp.industries?.[0] || 'SaaS'} ${icp.geos?.[0] || ''}"
  "site:linkedin.com/company ${icp.industries?.[0] || 'AI'}"
  "site:producthunt.com ${icp.industries?.[0] || 'productivity'}"

**SEARCH STRATEGY:**
- Start with 3-5 diverse queries in your first search batch
- If results are poor quality, try different keywords
- Prioritize actual company websites over directories
- Mix broad and specific queries for coverage

═══════════════════════════════════════════════════════
🎬 OPTIMAL WORKFLOW (FOLLOW THIS PATTERN)
═══════════════════════════════════════════════════════

**ITERATION 1-3: Cast Wide Net**
1. Execute 3-5 searches with diverse queries
2. Visit top 10-15 company websites IN PARALLEL
3. For each company, visit homepage + contact + team pages
4. Save companies that have emails (aim for 5-10 companies per iteration)

**ITERATION 4-10: Deep Qualification**
1. If you have < 50% of target, do more searches
2. For promising companies, visit additional pages (/about, /careers, /leadership)
3. Extract ALL possible contacts (aim for 3-5+ per company)
4. Save only ICP-aligned companies with decision-maker emails

**ITERATION 10+: Quality Refinement**
1. Review what's working - which search queries yielded best results?
**EXCELLENT PERFORMANCE:**
- 80%+ of companies have 3+ contacts
- 90%+ of contacts have emails
- 100% ICP alignment
- Average 5+ contacts per company

**GOOD PERFORMANCE:**
- 60%+ of companies have 2+ contacts
- 80%+ of contacts have emails
- 90% ICP alignment
- Average 3+ contacts per company

**NEEDS IMPROVEMENT:**
- < 50% of companies have 2+ contacts
- < 70% of contacts have emails
- < 80% ICP alignment

YOUR TOOLS (use in parallel whenever possible):
1. search_companies - DuckDuckGo search
2. visit_website - Extract data from any URL
3. save_company - Save qualified companies with contacts
4. refine_search_strategy - Evaluate and adjust

Remember: QUALITY > QUANTITY. Better to save 50 perfect companies with 250 contacts than 100 companies with 100 contacts.

Be strategic, thorough, and relentless in finding contact information. Good luck! 🚀`;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Begin lead generation. Find ${maxCompanies} companies matching the ICP.

WORKFLOW TO FOLLOW:
1. First, use search_companies to find relevant companies
2. Then, use visit_website IN PARALLEL on multiple promising URLs from the search results
3. After extracting data, IMMEDIATELY use save_company if you found AT LEAST ONE email
4. For missing company info, provide defaults (description can be basic, industry from ICP)
5. Save ALL emails as separate contacts - if you found 5 emails, create 5 contact objects
6. Continue this cycle (search → visit → save) until you reach ${maxCompanies} saved companies

IMPORTANT: 
- Create separate contact entry for EACH email found (leave name empty if unknown)
- Don't skip companies due to missing description/industry - provide reasonable defaults
- The goal is to save companies WITH contacts, not to be perfectionist about company details

Start now by searching for companies.`
    }
  ];

  let companiesSaved = 0;
  let contactsSaved = 0;
  let iterations = 0;
  const maxIterations = 50; // Prevent infinite loops
  const context = { jobId, poolId, logs: [], icp, userId };

  // Buffer logs locally to reduce DB write conflicts
  let logBuffer: Array<{ ts: string; msg: string; level?: string }> = [];
  let lastDbUpdate = Date.now();
  const DB_UPDATE_INTERVAL = 3000; // Only update DB every 3 seconds

  // Helper to add log to buffer
  const addLog = (logMsg: string, level?: string) => {
    logBuffer.push({ ts: new Date().toISOString(), msg: logMsg, level });
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

    const logsToWrite = [...logBuffer];
    const updateData: any = {
      logs: logsToWrite,
      counters: {
        companiesSaved,
        contactsSaved,
        iterations,
        progress: Math.min(100, Math.round((companiesSaved / maxCompanies) * 100))
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

  while (iterations < maxIterations && companiesSaved < maxCompanies) {
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
          iterations
        };
      }
    } catch (statusCheckError) {
      console.error("Failed to check job status:", statusCheckError);
      // Continue anyway - don't crash on status check
    }

    try {
      const response = await openai.chat.completions.create({
        model: deployment,
        messages,
        tools: agentTools as any,
        tool_choice: "auto",
        temperature: 1
      });

      const message = response.choices[0].message;
      messages.push(message);

      // Check if agent wants to use tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCount = message.tool_calls.length;
        addLog(`🎬 Executing ${toolCount} tool${toolCount > 1 ? 's' : ''} in parallel...`);

        // Execute all tool calls in parallel using Promise.all
        const toolExecutionPromises = message.tool_calls.map(async (toolCall, index) => {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`Agent calling: ${toolName}`, toolArgs);

          // Create detailed log message based on tool type
          let logMsg = "";
          switch (toolName) {
            case "search_companies":
              logMsg = `🔍 [${index + 1}/${toolCount}] Searching: "${toolArgs.query}"`;
              break;
            case "visit_website":
              const urlDomain = extractDomain(toolArgs.url);
              logMsg = `🌐 [${index + 1}/${toolCount}] Visiting: ${urlDomain || toolArgs.url}`;
              break;
            case "analyze_company_fit":
              logMsg = `🔬 [${index + 1}/${toolCount}] Analyzing: ${toolArgs.domain}`;
              break;
            case "save_company":
              logMsg = `💾 [${index + 1}/${toolCount}] Saving: ${toolArgs.companyName || toolArgs.domain}`;
              break;
            case "refine_search_strategy":
              logMsg = `🎯 [${index + 1}/${toolCount}] Strategy: ${toolArgs.reasoning.substring(0, 100)}...`;
              break;
            default:
              logMsg = `🤖 [${index + 1}/${toolCount}] ${toolName}`;
          }

          // Log start (buffered)
          addLog(logMsg);

          // Execute tool
          const startTime = Date.now();
          const toolResult = await executeToolCall(toolName, toolArgs, context);
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);

          // Log completion with result summary
          let completionMsg = "";
          switch (toolName) {
            case "search_companies":
              const resultCount = toolResult.results?.length || toolResult.count || 0;
              completionMsg = `✓ [${index + 1}/${toolCount}] Search complete: ${resultCount} results in ${duration}s`;
              break;
            case "visit_website":
              const visitDomain = extractDomain(toolArgs.url);
              const emails = toolResult.data?.emails?.length || 0;
              completionMsg = `✓ [${index + 1}/${toolCount}] ${visitDomain}: ${emails} emails, ${toolResult.data?.phones?.length || 0} phones (${duration}s)`;
              break;
            case "save_company":
              if (toolResult.success) {
                completionMsg = `✓ [${index + 1}/${toolCount}] ✅ SAVED: ${toolArgs.companyName || toolArgs.domain} with ${toolResult.contactsCreated} contacts (${duration}s)`;
              } else {
                completionMsg = `✗ [${index + 1}/${toolCount}] ❌ FAILED: ${toolArgs.companyName || toolArgs.domain} - ${toolResult.error} (${duration}s)`;
                // Also log to console for debugging
                console.error("[SAVE_FAILED]", toolArgs.companyName, toolResult.error);
              }
              break;
            default:
              completionMsg = `✓ [${index + 1}/${toolCount}] ${toolName} complete (${duration}s)`;
          }
          addLog(completionMsg);

          return {
            toolCall,
            toolName,
            toolResult
          };
        });

        // Wait for all tools to complete
        const completedTools = await Promise.all(toolExecutionPromises);

        // Process results and add to conversation
        for (const { toolCall, toolName, toolResult } of completedTools) {
          // Track saves
          if (toolName === "save_company" && toolResult.success) {
            companiesSaved++;
            contactsSaved += toolResult.contactsCreated || 0;
          }

          // Add tool result to conversation
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }

        // Log summary with updated counters
        const saveCount = completedTools.filter(t => t.toolName === "save_company" && t.toolResult.success).length;
        const visitCount = completedTools.filter(t => t.toolName === "visit_website").length;
        const searchCount = completedTools.filter(t => t.toolName === "search_companies").length;

        let summary = `✅ Batch complete:`;
        if (searchCount > 0) summary += ` ${searchCount} search${searchCount > 1 ? 'es' : ''}`;
        if (visitCount > 0) summary += ` ${visitCount} visit${visitCount > 1 ? 's' : ''}`;
        if (saveCount > 0) summary += ` ${saveCount} saved`;
        summary += ` | Total: ${companiesSaved}/${maxCompanies} companies (${contactsSaved} contacts)`;

        addLog(summary);

        // Flush logs to DB after batch completion
        await flushLogsToDb(false);
      } else if (message.content) {
        // Agent is thinking/reasoning
        console.log("Agent reasoning:", message.content);
        addLog(`💭 Agent thinking: ${message.content}`);

        // Check if agent thinks it's done
        if (message.content.toLowerCase().includes("complete") ||
          message.content.toLowerCase().includes("finished") ||
          companiesSaved >= maxCompanies) {
          addLog("✅ Agent believes task is complete");
          await flushLogsToDb(true); // Force flush
          break;
        }

        // Add a user message to keep it going with more direct instructions
        if (companiesSaved < maxCompanies) {
          const feedbackMsg = `Progress: ${companiesSaved}/${maxCompanies} companies saved (${contactsSaved} contacts).

${companiesSaved === 0 ? '⚠️ You haven\'t saved ANY companies yet!\n\n' : ''}IMMEDIATE NEXT STEP:
1. Look at the website data you've extracted
2. For EACH website with emails, call save_company RIGHT NOW
3. Format: { domain, companyName, description, industry, techStack: [], contacts: [{name: "", title: "Contact", email: "...", phone: "..."}] }

Don't keep searching - SAVE the companies you've already found!`;

          messages.push({
            role: "user",
            content: feedbackMsg
          });
          addLog(`📍 Checkpoint: ${companiesSaved}/${maxCompanies} companies | Directing agent to save...`);
          await flushLogsToDb(false); // Opportunistic flush
        }
      }

      // Safety: Add delay between iterations
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error("Agent iteration error:", error);
      addLog(`Agent error: ${(error as Error).message}`, "ERROR");
      await flushLogsToDb(true); // Force flush errors
      break;
    }
  }

  // Log completion
  addLog(`🤖 Agent complete: ${companiesSaved} companies, ${contactsSaved} contacts in ${iterations} iterations`);
  await flushLogsToDb(true); // Force final flush

  return {
    companiesSaved,
    contactsSaved,
    iterations
  };
}
