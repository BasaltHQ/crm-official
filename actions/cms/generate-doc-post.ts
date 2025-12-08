"use server";

import { getAiSdkModel, isReasoningModel } from "@/lib/openai";
import { generateObject } from "ai";
import { z } from "zod";

export async function generateDocPost(topic: string) {
    const model = await getAiSdkModel("system");
    if (!model) {
        throw new Error("AI model not configured");
    }

    const prompt = `
    You are an expert Technical Writer for Ledger1CRM.
    Your goal is to write clear, concise, and helpful documentation on the topic: "${topic}".

    Content Requirements:
    1.  Structure:
        -   Overview: Briefly explain what this guide covers and why it's important.
        -   Prerequisites: Bullet points of what is needed before starting (if applicable).
        -   Step-by-Step Guide: Use numbered lists for instructions. Be specific.
        -   Troubleshooting / FAQ: Common issues users might face.
        -   Next Steps: Where to go from here.
    2.  Tone & Style:
        -   Technical, precise, and objective.
        -   Use "You" to address the user.
        -   Avoid marketing fluff.
    3.  Formatting (Github Flavored Markdown):
        -   Use **bold** for UI elements, buttons, and key terms.
        -   Use \`code blocks\` with language syntax highlighting (e.g. \`\`\`bash) for commands.
        -   Use > blockquotes for tips, notes, or warnings.
        -   Use proper H2 (##) and H3 (###) hierarchy. No H1 in content.
        -   Use nice readable spacing between sections.
  `;

    try {
        const { object } = await generateObject({
            model,
            schema: z.object({
                title: z.string().describe("A clear, descriptive title."),
                slug: z.string().describe("A URL-friendly slug based on the title."),
                category: z.enum(["Getting Started", "Configuration", "API Reference", "Troubleshooting", "Integrations"]).describe("The most relevant category."),
                content: z.string().describe("The full documentation article in clean Markdown."),
            }),
            messages: [
                { role: "system", content: "You are a helpful AI assistant that generates technical documentation." },
                { role: "user", content: prompt },
            ],
            temperature: isReasoningModel(model.modelId) ? undefined : 1,
        });

        return object;
    } catch (error) {
        console.error("Error generating doc post:", error);
        throw new Error("Failed to generate doc post");
    }
}
