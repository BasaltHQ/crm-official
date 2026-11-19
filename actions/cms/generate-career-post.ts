"use server";

import { getAiSdkModel, isReasoningModel, logAiUsage } from "@/lib/varuni";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { generateObject } from "ai";
import { z } from "zod";

export async function generateCareerPost(jobTitle: string) {
    const admin = await requirePlatformAdmin();
    if (!admin) throw new Error("Forbidden");
    const { model, modelId, teamId } = await getAiSdkModel("system");
    if (!model) {
        throw new Error("AI model not configured");
    }

    const prompt = `
    You are an expert HR Specialist and Recruiter for BasaltCRM.
    Your goal is to write a compelling, inclusive, and professional job description for the role: "${jobTitle}".
    
    Content Requirements:
    1.  Structure:
        -   Job Summary: High-level overview of the role and its impact.
        -   Responsibilities: Bulleted list of key duties (5-7 items).
        -   Requirements: Bulleted list of must-have skills and qualifications.
        -   Nice-to-Haves: Optional but preferred skills.
        -   Benefits & Perks: What we offer (remote work, healthcare, etc.).
        -   Company Culture: Brief description of our values.
    2.  Tone & Style:
        -   Professional, welcoming, and exciting.
        -   Use inclusive language.
        -   Focus on growth and impact.
    3.  Formatting:
        -   Use H2s for section headers.
        -   Use bullet points for lists.
    `;

    try {
        const { object } = await generateObject({
            model,
            schema: z.object({
                title: z.string().describe("The official job title, optimized for search."),
                department: z.string().describe("The department this role belongs to (e.g., Engineering, Sales, Marketing)."),
                location: z.string().describe("Remote, Hybrid, or specific location."),
                employmentType: z.enum(["Full-time", "Part-time", "Contract", "Internship"]).describe("Type of employment."),
                summary: z.string().describe("A brief one-paragraph summary of the role."),
                content: z.string().describe("The full job description in clean Markdown."),
            }),
            messages: [
                { role: "system", content: "You are a helpful AI assistant that generates job descriptions." },
                { role: "user", content: prompt },
            ],
            temperature: isReasoningModel(model.modelId) ? undefined : 1,
        });

        await logAiUsage({ teamId, userId: null, service: "general", model: modelId || "unknown",
            usage: { promptTokens: (object as any)?.usage?.promptTokens || 0, completionTokens: (object as any)?.usage?.completionTokens || 0 },
            description: "CMS career post generation" });

        // Return with type alias for backwards compatibility
        return {
            ...object,
            type: object.employmentType,
        };
    } catch (error) {
        console.error("Error generating career post:", error);
        throw new Error("Failed to generate career post");
    }
}
