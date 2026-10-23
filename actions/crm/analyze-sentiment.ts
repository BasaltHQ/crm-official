import { getAiSdkModel, logAiUsage } from "@/lib/varuni";
import { generateObject } from "ai";
import { z } from "zod";
import { systemLogger } from "@/lib/logger";
import { evaluateReplyIntelligence, type ReplyDecisionScope } from "@/lib/ai/reply-intelligence";
import { deriveReplyDecision } from "@/lib/ai/reply-decisions";

export interface SentimentResult {
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL";
  reasoning: string;
  suggestedAction: string;
  decision?: ReturnType<typeof deriveReplyDecision>["decision"];
  extractedContact?: {
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
    phone?: string;
    email?: string;
  };
}

/**
 * Analyzes the sentiment of a reply to an outreach email using AI.
 *
 * - POSITIVE: Interested, wants to meet, asks follow-up questions, requests pricing
 * - NEGATIVE: Not interested, wrong person, do not contact, unsubscribe intent
 * - NEUTRAL: Auto-reply, OOO, generic acknowledgment, forwarded to someone else
 *
 * @param snippet The reply text or snippet to analyze
 * @param context Additional context about the outreach (original subject, lead info)
 * @param userId The user ID for AI model resolution
 */
export async function analyzeReplySentiment(
  snippet: string,
  context: {
    originalSubject?: string;
    leadName?: string;
    leadCompany?: string;
    extractContact?: boolean;
  },
  userId: string,
  decisionScope?: ReplyDecisionScope,
): Promise<SentimentResult> {
  const fallback: SentimentResult = {
    sentiment: "NEUTRAL",
    reasoning: "Could not analyze sentiment — defaulting to neutral for human review.",
    suggestedAction: "REVIEW",
  };

  if (!snippet || snippet.trim().length < 5) return fallback;

  const primary = decisionScope ? await evaluateReplyIntelligence({
    ...decisionScope, userId, reply: snippet, context,
  }) : undefined;
  if (primary && !context.extractContact) return primary;

  try {
    const { model, modelId, teamId } = await getAiSdkModel(userId);
    if (!model) return primary || fallback;

    const systemPrompt = [
      "You are a CRM AI assistant classifying the sentiment of a reply to a sales/outreach email.",
      "Classify the reply into exactly one of: POSITIVE, NEGATIVE, or NEUTRAL.",
      "",
      "POSITIVE indicators: interest in meeting, asking about pricing/features, requesting a demo,",
      "asking follow-up questions, expressing curiosity, wanting to learn more, scheduling intent.",
      "",
      "NEGATIVE indicators: 'not interested', 'please remove me', 'do not contact',",
      "'wrong person', 'stop emailing', explicit rejection, hostile tone.",
      "",
      "NEUTRAL indicators: out-of-office auto-reply, generic acknowledgment ('thanks for reaching out'),",
      "'I'll forward this to...', vacation messages, automated responses, ambiguous one-liners.",
      "",
      "Also suggest the next action:",
      "- POSITIVE → 'CREATE_OPPORTUNITY' (move to sales pipeline)",
      "- NEGATIVE → 'TAG_FOR_REVIEW' (flag for human decision)",
      "- NEUTRAL → 'SCHEDULE_RECHECK' (check again later)",
      "",
      "Finally, attempt to extract the sender's contact information (first name, last name, job title, phone number, and email)",
      "by looking at their email signature or how they signed off the email. If you cannot find this information,",
      "leave the fields empty.",
    ].join("\n");

    const userPrompt = [
      "Analyze this reply to our outreach email:",
      "",
      `Original subject: "${context.originalSubject || "N/A"}"`,
      `Lead: ${context.leadName || "Unknown"} at ${context.leadCompany || "Unknown"}`,
      "",
      "--- Reply ---",
      snippet.substring(0, 2000), // Cap at 2000 chars to control token usage
      "--- End ---",
    ].join("\n");

    const { object, usage } = await generateObject({
      model,
      schema: z.object({
        sentiment: z.enum(["POSITIVE", "NEGATIVE", "NEUTRAL"]),
        reasoning: z.string(),
        suggestedAction: z.string(),
        extractedContact: z.object({
          firstName: z.string().optional(),
          lastName: z.string().optional(),
          jobTitle: z.string().optional(),
          phone: z.string().optional(),
          email: z.string().optional(),
        }).optional(),
      }),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    // Track AI usage
    await logAiUsage({
      teamId,
      userId,
      service: "sentiment_analysis" as any,
      model: modelId || "unknown",
      usage: {
        promptTokens: (usage as any)?.promptTokens || 0,
        completionTokens: (usage as any)?.completionTokens || 0,
      },
      description: "Reply sentiment analysis",
    });

    systemLogger.info(
      `[SENTIMENT] Result: ${object.sentiment} — ${object.reasoning.substring(0, 100)}`
    );

    return {
      sentiment: object.sentiment,
      reasoning: object.reasoning,
      suggestedAction: object.suggestedAction,
      ...primary,
      extractedContact: object.extractedContact,
    };
  } catch (err: any) {
    systemLogger.error(`[SENTIMENT] Analysis failed: ${err?.message}`);
    return primary || fallback;
  }
}
