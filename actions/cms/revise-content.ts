"use server";

import { getAiSdkModel, isReasoningModel } from "@/lib/openai";
import { generateText } from "ai";

export async function reviseContent(
    content: string,
    instruction: string,
    type: "blog" | "docs" | "career"
) {
    const model = await getAiSdkModel("system");
    if (!model) {
        throw new Error("AI model not configured");
    }

    let roleDescription = "";
    switch (type) {
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
    
    You will be provided with existing content and an instruction on how to revise it.
    
    **Instruction**: "${instruction}"
    
    **Existing Content**:
    """
    ${content}
    """
    
    Return the **revised content** in Markdown format.
    Do NOT include any explanations, preambles, or conversational text. Just the revised content.
    `;

    try {
        const { text } = await generateText({
            model,
            messages: [
                { role: "system", content: "You are a helpful AI editor." },
                { role: "user", content: prompt },
            ],
            temperature: isReasoningModel(model.modelId) ? undefined : 1,
        });

        return text;
    } catch (error) {
        console.error("Error revising content:", error);
        throw new Error("Failed to revise content");
    }
}
