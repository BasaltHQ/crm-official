"use server";

import { AzureOpenAI } from "openai";

export async function generateMediaSEO(filename: string, existingContext?: string) {
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
        throw new Error("Azure OpenAI credentials not configured");
    }

    const client = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2025-01-01-preview",
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    });

    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5";

    const prompt = `
    You are an expert SEO Content Generator.
    Your goal is to generate optimized metadata for a media asset based on its filename and potentially some context.
    
    Filename: "${filename}"
    Context: "${existingContext || 'No description provided'}"
    
    Return the response as a **valid JSON object** with the following fields:
    - title: A clean, descriptive title for the image (capitalized, no extension).
    - altText: A descriptive alt text optimized for accessibility and SEO.
    - caption: A short, engaging caption suitable for a blog or gallery.
    - description: A longer description of what the image likely represents or how it could be used.

    **IMPORTANT**: Return ONLY the raw JSON string.
  `;

    try {
        const response = await client.chat.completions.create({
            model: deployment,
            messages: [
                { role: "system", content: "You are a helpful AI assistant that generates metadata in JSON format." },
                { role: "user", content: prompt },
            ],
            temperature: 1.0,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error("No content generated");
        }

        return JSON.parse(content);
    } catch (error) {
        console.error("Error generating media SEO:", error);
        throw new Error("Failed to generate metadata");
    }
}
