"use server";

import { getAiSdkModel, isReasoningModel } from "@/lib/openai";
import { generateObject } from "ai";
import { z } from "zod";

export async function generateBlogPost(topic: string) {
    const model = await getAiSdkModel("system");
    if (!model) {
        throw new Error("AI model not configured");
    }

    const prompt = `
    You are an expert SEO Content Writer for BasaltCRM, a leading CRM platform powered by AI.
    Your goal is to write a high-ranking, authoritative, and engaging blog post on the topic: "${topic}".
    
    Content Requirements:
    1.  Structure:
        -   Introduction: Hook the reader immediately. Define the problem and promise a solution.
        -   Key Takeaways: A bulleted list of 3-4 main points right after the intro.
        -   Deep Dive Sections: Use H2s for main sections and H3s for subsections.
        -   "People Also Ask": Include a section answering 3 common questions related to the topic.
        -   Conclusion: Summarize and provide a final thought.
    2.  SEO Strategy:
        -   Include the main keyword "${topic}" naturally in the first 100 words.
        -   Use semantic LSI keywords related to CRM, AI, sales automation, and business growth.
        -   Optimize for Featured Snippets (short, direct answers to questions).
    3.  Tone & Style:
        -   Professional yet accessible (Grade 8-10 readability).
        -   Authoritative but helpful.
        -   Avoid fluff and generic AI phrases. Be direct.
    4.  Formatting:
        -   Use **bold** for emphasis on key phrases.
        -   Use bullet points and numbered lists to break up text.
        -   Keep paragraphs short (2-3 sentences).
    5.  Call to Action (CTA):
        -   End with a strong CTA encouraging readers to try BasaltCRM to solve their sales challenges.
  `;

    try {
        const { object } = await generateObject({
            model,
            schema: z.object({
                title: z.string().describe("A catchy, high-CTR title (60 chars max) that includes the main keyword."),
                slug: z.string().describe("A URL-friendly slug based on the title."),
                excerpt: z.string().describe("A compelling meta description (150-160 chars) optimized for clicks."),
                category: z.enum(["Sales AI", "CRM Strategy", "Automation", "Future of Work"]).describe("The most relevant category."),
                content: z.string().describe("The full blog post in clean Markdown."),
            }),
            messages: [
                { role: "system", content: "You are a helpful AI assistant that generates blog content." },
                { role: "user", content: prompt },
            ],
            temperature: isReasoningModel(model.modelId) ? undefined : 1,
        });

        return object;
    } catch (error) {
        console.error("Error generating blog post:", error);
        throw new Error("Failed to generate blog post");
    }
}
