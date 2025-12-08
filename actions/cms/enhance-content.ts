"use server";

import { getAiSdkModel, isReasoningModel } from "@/lib/openai";
import { generateObject } from "ai";
import { z } from "zod";

interface EnhanceContext {
    title: string;
    content: string;
    category: string;
    type: "docs" | "blog" | "career";
}

interface EnhanceResult {
    title?: string;
    content?: string;
    category?: string;
    summary?: string; // For blog/careers
}

export async function enhanceContent(
    context: EnhanceContext,
    instruction: string
): Promise<EnhanceResult> {
    const model = await getAiSdkModel("system");
    if (!model) {
        throw new Error("AI model not configured");
    }

    let roleDescription = "";
    switch (context.type) {
        case "blog":
            roleDescription = "Expert SEO Content Writer";
            break;
        case "docs":
            roleDescription = "Expert Technical Writer";
            break;
        case "career":
            roleDescription = "Expert HR & Recruitment Specialist";
            break;
    }

    const prompt = `
    You are an ${roleDescription}.
    
    You are provided with a ${context.type} post draft.
    
    **Current Context**:
    - Title: "${context.title}"
    - Category: "${context.category}"
    - Content: 
    """
    ${context.content}
    """
    
    **User Instruction**: "${instruction}"
    
    **Style Guidelines**:
    -   Use **Github Flavored Markdown (GFM)**.
    -   Use **bold** for UI elements, buttons, and field names.
    -   Use *italics* for emphasis.
    -   Use \`code blocks\` with language specification (e.g., \`\`\`typescript) for code.
    -   Use > blockquotes for important notes or warnings.
    -   Ensure headers (#, ##, ###) are strictly hierarchical.
    -   Use - or * for bullet points.
    
    Based on the instruction and the current context, please revise the content. You may update the Title, Content, or Category.
  `;

    try {
        const { object } = await generateObject({
            model,
            schema: z.object({
                title: z.string().describe("Revised title").optional(),
                content: z.string().describe("Revised content in Markdown").optional(),
                category: z.string().describe("Revised category").optional(),
                summary: z.string().describe("Revised summary (if applicable)").optional(),
            }),
            messages: [
                { role: "system", content: "You are a helpful AI editor." },
                { role: "user", content: prompt },
            ],
            temperature: isReasoningModel(model.modelId) ? undefined : 1,
        });

        return object as EnhanceResult;
    } catch (error: any) {
        console.error("Error enhancing content:", error);
        throw new Error(`Failed to enhance content: ${error.message || error}`);
    }
}
