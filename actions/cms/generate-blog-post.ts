"use server";

import { AzureOpenAI } from "openai";

export async function generateBlogPost(topic: string) {
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
        throw new Error("Azure OpenAI credentials not configured");
    }

    const client = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-04-01-preview",
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    });

    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5-nano";

    const prompt = `
    You are an expert content writer for a CRM company called Ledger1CRM.
    Write a high-quality, engaging blog post about the following topic: "${topic}".
    
    Return the response as a valid JSON object with the following fields:
    - title: A catchy, SEO-friendly title.
    - slug: A URL-friendly slug based on the title.
    - excerpt: A short, engaging summary (max 160 chars).
    - category: A relevant category (e.g., Sales, AI, Marketing, CRM).
    - content: The full blog post content in Markdown format. Use headers, bullet points, and bold text for readability.
    
    Do not include any markdown formatting (like \`\`\`json) around the JSON output. Just return the raw JSON string.
  `;

    try {
        const response = await client.chat.completions.create({
            model: deployment,
            messages: [
                { role: "system", content: "You are a helpful AI assistant that generates blog content in JSON format." },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error("No content generated");
        }

        return JSON.parse(content);
    } catch (error) {
        console.error("Error generating blog post:", error);
        throw new Error("Failed to generate blog post");
    }
}
