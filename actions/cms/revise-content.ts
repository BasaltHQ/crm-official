"use server";

import { getAiSdkModel, isReasoningModel, logAiUsage } from "@/lib/varuni";
import { requirePlatformAdmin } from "@/lib/security/authz";
import { generateText } from "ai";

export async function reviseContent(
    content: string,
    instruction: string,
    type: "blog" | "docs" | "career"
) {
    const admin = await requirePlatformAdmin();
    if (!admin) throw new Error("Forbidden");
    const { model, modelId, teamId } = await getAiSdkModel("system");
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
        const { text, usage } = await generateText({
            model,
            messages: [
                { role: "system", content: "You are a helpful AI editor." },
                { role: "user", content: prompt },
            ],
            temperature: isReasoningModel(model.modelId) ? undefined : 1,
        });

        await logAiUsage({ teamId, userId: null, service: "general", model: modelId || "unknown",
            usage: { promptTokens: (usage as any)?.promptTokens || 0, completionTokens: (usage as any)?.completionTokens || 0 },
            description: "CMS content revision" });

        return text;
    } catch (error) {
        console.error("Error revising content:", error);
        throw new Error("Failed to revise content");
    }
}
