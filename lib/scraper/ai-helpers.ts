/**
 * AI-Powered Lead Generation Helpers
 * Uses OpenAI/Azure OpenAI for intelligent query generation, content analysis, and entity resolution
 */

import { getAiSdkModel, isReasoningModel } from "@/lib/openai";
import { generateObject } from "ai";
import { z } from "zod";

type ICPConfig = {
  industries?: string[];
  companySizes?: string[];
  geos?: string[];
  techStack?: string[];
  titles?: string[];
  languages?: string[];
  excludeDomains?: string[];
  notes?: string;
  limits?: {
    maxCompanies?: number;
    maxContactsPerCompany?: number;
  };
};

/**
 * AI Form Completion: Use AI reasoning to complete ALL ICP form fields based on a natural language prompt
 */
export async function parseICPFromNaturalLanguage(
  naturalLanguagePrompt: string,
  userId: string
): Promise<{
  industries: string[];
  companySizes: string[];
  geos: string[];
  techStack: string[];
  titles: string[];
  languages: string[];
  notes: string;
}> {
  try {
    const model = await getAiSdkModel(userId);
    if (!model) {
      console.warn("AI model not configured, returning empty ICP");
      return {
        industries: [],
        companySizes: [],
        geos: [],
        techStack: [],
        titles: [],
        languages: [],
        notes: naturalLanguagePrompt,
      };
    }

    const prompt = `You are an expert B2B sales and marketing strategist.
User Request: "${naturalLanguagePrompt}"

Fill out ALL fields using knowledge:
1. industries: 3-5 specific & broad categories.
2. companySizes: Ranges like 1-10, 10-50, etc.
3. geos: Target regions.
4. techStack: Relevant technologies.
5. titles: Decision maker titles.
6. languages: Primary languages.
7. notes: Summary of the request.`;

    const result = await generateObject({
      model: model,
      schema: z.object({
        industries: z.array(z.string()),
        companySizes: z.array(z.string()),
        geos: z.array(z.string()),
        techStack: z.array(z.string()),
        titles: z.array(z.string()),
        languages: z.array(z.string()),
        notes: z.string(),
      }),
      prompt: prompt,
    });

    return result.object;
  } catch (error) {
    console.error("AI form completion failed:", error);
  }

  // Fallback
  return {
    industries: ["General Business"],
    companySizes: ["10-50", "50-200"],
    geos: ["United States"],
    techStack: [],
    titles: ["CEO", "Founder", "Owner"],
    languages: ["English"],
    notes: naturalLanguagePrompt,
  };
}

/**
 * Generate intelligent search queries using AI based on ICP
 */
export async function generateAISearchQueries(
  icp: ICPConfig,
  userId: string,
  count: number = 10
): Promise<string[]> {
  try {
    const model = await getAiSdkModel(userId);
    if (!model) {
      console.warn("AI model not configured, using fallback queries");
      return generateFallbackQueries(icp);
    }

    const prompt = `Generate ${count} highly effective search queries to find companies matching this profile:

Industries: ${icp.industries?.join(", ") || "Any"}
Geographies: ${icp.geos?.join(", ") || "Global"}
Tech Stack: ${icp.techStack?.join(", ") || "Any"}
Company Sizes: ${icp.companySizes?.join(", ") || "Any"}
Target Titles: ${icp.titles?.join(", ") || "Any"}
${icp.notes ? `Additional Notes: ${icp.notes}` : ""}

Requirements:
1. Focus on finding company websites and directories
2. Use site: operators for LinkedIn, Crunchbase, etc.
3. Include industry-specific terms
4. Vary query structure for diversity
5. Target business directories and listings`;

    const result = await generateObject({
      model,
      schema: z.object({
        queries: z.array(z.string()),
      }),
      prompt,
      system: "You are an expert at crafting search queries for B2B lead generation. Generate diverse, effective queries that will find relevant company websites.",
    });

    const queries = result.object.queries.slice(0, count);
    return queries.length > 0 ? queries : generateFallbackQueries(icp);
  } catch (error) {
    console.error("AI query generation failed:", error);
    return generateFallbackQueries(icp);
  }
}

/**
 * Fallback query generation without AI
 */
function generateFallbackQueries(icp: ICPConfig): string[] {
  const industry = icp.industries?.[0] || "technology";
  const geo = icp.geos?.[0] || "United States";
  const tech = icp.techStack?.[0] || "";

  return [
    `site:linkedin.com/company ${industry} ${geo}`,
    `site:crunchbase.com/organization ${industry} ${geo}`,
    `${industry} companies in ${geo}`,
    `${industry} startups ${geo}`,
    `top ${industry} companies`,
    ...(tech ? [`${industry} companies using ${tech}`] : [])
  ];
}

/**
 * Analyze company description and extract structured data using AI
 */
export async function analyzeCompanyWithAI(
  domain: string,
  description: string,
  userId: string
): Promise<{
  industry: string | null;
  companyType: string | null;
  techStack: string[];
  businessModel: string | null;
  targetMarket: string | null;
  confidence: number;
}> {
  try {
    const model = await getAiSdkModel(userId);
    if (!model) {
      return {
        industry: null,
        companyType: null,
        techStack: [],
        businessModel: null,
        targetMarket: null,
        confidence: 0
      };
    }

    const prompt = `Analyze this company and extract structured information:

Domain: ${domain}
Description: ${description}`;

    const result = await generateObject({
      model,
      schema: z.object({
        industry: z.string().nullable(),
        companyType: z.string().nullable(),
        techStack: z.array(z.string()),
        businessModel: z.string().nullable(),
        targetMarket: z.string().nullable(),
        confidence: z.number().min(0).max(100),
      }),
      prompt,
      system: "You are a B2B company analyst. Analyze companies and return structured JSON data.",
    });

    return result.object;
  } catch (error) {
    console.error("AI company analysis failed:", error);
  }

  return {
    industry: null,
    companyType: null,
    techStack: [],
    businessModel: null,
    targetMarket: null,
    confidence: 0
  };
}

/**
 * Calculate AI-enhanced ICP fit score
 */
export async function calculateAIICPScore(
  company: {
    domain: string;
    companyName?: string | null;
    description?: string | null;
    industry?: string | null;
    techStack?: any;
  },
  icp: ICPConfig,
  userId: string
): Promise<{
  score: number;
  reasoning: string;
  recommendations: string[];
}> {
  try {
    const model = await getAiSdkModel(userId);
    if (!model) {
      return {
        score: 50,
        reasoning: "AI not available for scoring",
        recommendations: []
      };
    }

    const prompt = `Evaluate how well this company fits the Ideal Customer Profile:

COMPANY:
- Domain: ${company.domain}
- Name: ${company.companyName || "Unknown"}
- Description: ${company.description || "No description"}
- Industry: ${company.industry || "Unknown"}
- Tech Stack: ${JSON.stringify(company.techStack || [])}

IDEAL CUSTOMER PROFILE:
- Target Industries: ${icp.industries?.join(", ") || "Any"}
- Target Geos: ${icp.geos?.join(", ") || "Any"}
- Required Tech: ${icp.techStack?.join(", ") || "Any"}
- Company Sizes: ${icp.companySizes?.join(", ") || "Any"}
- Target Titles: ${icp.titles?.join(", ") || "Any"}
${icp.notes ? `- Additional: ${icp.notes}` : ""}`;

    const result = await generateObject({
      model,
      schema: z.object({
        score: z.number().min(0).max(100),
        reasoning: z.string(),
        recommendations: z.array(z.string()),
      }),
      prompt,
      system: "You are a B2B sales intelligence analyst. Evaluate company-ICP fit and provide actionable recommendations.",
    });

    return {
      score: result.object.score,
      reasoning: result.object.reasoning,
      recommendations: result.object.recommendations.slice(0, 3)
    };
  } catch (error) {
    console.error("AI ICP scoring failed:", error);
  }

  return {
    score: 50,
    reasoning: "AI scoring unavailable",
    recommendations: []
  };
}

/**
 * Extract contact information from unstructured text using AI
 */
export async function extractContactsWithAI(
  text: string,
  companyDomain: string,
  userId: string
): Promise<Array<{
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  confidence: number;
}>> {
  try {
    const model = await getAiSdkModel(userId);
    if (!model) {
      return [];
    }

    const prompt = `Extract contact information from this text about ${companyDomain}:

${text.substring(0, 2000)}`;

    const result = await generateObject({
      model,
      schema: z.object({
        contacts: z.array(z.object({
          name: z.string().nullable(),
          title: z.string().nullable(),
          email: z.string().nullable(),
          phone: z.string().nullable(),
          linkedin: z.string().nullable(),
          confidence: z.number().min(0).max(100),
        })),
      }),
      prompt,
      system: "You are an expert at extracting structured contact information from unstructured text. Return valid JSON.",
    });

    return result.object.contacts.slice(0, 10);
  } catch (error) {
    console.error("AI contact extraction failed:", error);
  }

  return [];
}

/**
 * Resolve duplicate companies using AI to determine if they're the same entity
 */
export async function resolveDuplicateCompaniesWithAI(
  company1: { domain: string; companyName?: string | null; description?: string | null },
  company2: { domain: string; companyName?: string | null; description?: string | null },
  userId: string
): Promise<{
  areSame: boolean;
  confidence: number;
  reasoning: string;
}> {
  try {
    const model = await getAiSdkModel(userId);
    if (!model) {
      return {
        areSame: false,
        confidence: 0,
        reasoning: "AI not available"
      };
    }

    const prompt = `Determine if these are the same company:

COMPANY A:
- Domain: ${company1.domain}
- Name: ${company1.companyName || "Unknown"}
- Description: ${company1.description || "N/A"}

COMPANY B:
- Domain: ${company2.domain}
- Name: ${company2.companyName || "Unknown"}
- Description: ${company2.description || "N/A"}`;

    const result = await generateObject({
      model,
      schema: z.object({
        areSame: z.boolean(),
        confidence: z.number().min(0).max(100),
        reasoning: z.string(),
      }),
      prompt,
      system: "You are an expert at entity resolution. Determine if two company records represent the same entity.",
    });

    return result.object;
  } catch (error) {
    console.error("AI duplicate resolution failed:", error);
  }

  return {
    areSame: false,
    confidence: 0,
    reasoning: "Analysis failed"
  };
}

/**
 * Generate personalized outreach email using AI
 */
export async function generateOutreachEmailWithAI(
  contact: {
    name: string;
    title?: string | null;
    companyName: string;
    companyDescription?: string | null;
  },
  icp: ICPConfig,
  userId: string
): Promise<{
  subject: string;
  body: string;
}> {
  try {
    const model = await getAiSdkModel(userId);
    if (!model) {
      return {
        subject: `Connecting with ${contact.companyName}`,
        body: `Hi ${contact.name},\n\nI came across ${contact.companyName} and wanted to reach out.\n\nBest regards`
      };
    }

    const prompt = `Create a personalized B2B outreach email:

TO:
- Name: ${contact.name}
- Title: ${contact.title || "Team Member"}
- Company: ${contact.companyName}
- About: ${contact.companyDescription || ""}

CONTEXT:
- We target: ${icp.industries?.join(", ") || "technology companies"}
- In: ${icp.geos?.join(", ") || "global markets"}

Requirements:
1. Professional, concise (3-4 short paragraphs)
2. Reference their company specifically
3. Clear value proposition
4. Strong call-to-action
5. No salesy language`;

    const result = await generateObject({
      model,
      schema: z.object({
        subject: z.string(),
        body: z.string(),
      }),
      prompt,
      system: "You are an expert B2B sales professional. Write personalized, effective outreach emails.",
    });

    return result.object;
  } catch (error) {
    console.error("AI email generation failed:", error);
  }

  return {
    subject: `Connecting with ${contact.companyName}`,
    body: `Hi ${contact.name},\n\nI came across ${contact.companyName} and wanted to reach out.\n\nBest regards`
  };
}
