import crypto from "crypto";
import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getAiSdkModel, logAiUsage } from "@/lib/varuni";
import { generateObject } from "ai";
import { z } from "zod";
import { systemLogger } from "@/lib/logger";

export async function POST(req: Request) {
    try {
        const expectedSecret = process.env.SYNTHESIS_SECRET;
        if (!expectedSecret) {
            return NextResponse.json({ error: "Synthesis secret is not configured" }, { status: 500 });
        }

        const secret = req.headers.get("x-synthesis-secret") || "";
        const expectedBuf = Buffer.from(expectedSecret, "utf8");
        const providedBuf = Buffer.from(secret, "utf8");
        if (
            expectedBuf.length !== providedBuf.length ||
            !crypto.timingSafeEqual(expectedBuf, providedBuf)
        ) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { path, method, payload, timestamp } = await req.json();

        if (!payload) {
            return NextResponse.json({ success: true, reason: "No payload to synthesize" });
        }

        const payloadTenantId: string | null = payload.tenant_id || payload.team_id || null;

        // Try to identify context references from the URL or payload
        let accountId: string | undefined;
        let leadId: string | undefined;

        // Very basic heuristic to find IDs depending on your exact routes
        if (payload.accountId) {
            accountId = payload.accountId;
        } else if (typeof path === "string" && path.includes("/accounts/")) {
            const match = path.match(/\/accounts\/([a-f\d]{24})/i);
            if (match) accountId = match[1];
        }

        if (payload.leadId) {
            leadId = payload.leadId;
        } else if (typeof path === "string" && path.includes("/leads/")) {
            const match = path.match(/\/leads\/([a-f\d]{24})/i);
            if (match) leadId = match[1];
        }

        if (accountId) {
            const account = await prismadb.crm_Accounts.findUnique({
                where: { id: accountId },
                select: { id: true, team_id: true },
            });
            if (!account || (payloadTenantId && account.team_id && account.team_id !== payloadTenantId)) {
                return NextResponse.json({ error: "Forbidden: Account tenant mismatch" }, { status: 403 });
            }
        }

        if (leadId) {
            const lead = await prismadb.crm_Leads.findUnique({
                where: { id: leadId },
                select: { id: true, team_id: true },
            });
            if (!lead || (payloadTenantId && lead.team_id && lead.team_id !== payloadTenantId)) {
                return NextResponse.json({ error: "Forbidden: Lead tenant mismatch" }, { status: 403 });
            }
        }

        const { model } = await getAiSdkModel("system", "analysis");

        const { object, usage } = await generateObject({
            model: model as any,
            schema: z.object({
                summary: z.string().describe("A concise summary of what this mutation represents in the business context."),
                lifecycleStatus: z.string().optional().describe("Deduced lifecycle stage, e.g., EVALUATING, AT RISK, CHURNED."),
                sentimentScore: z.number().min(-1.0).max(1.0).describe("Sentiment of this interaction from -1.0 to 1.0"),
                intentLevel: z.string().default("UNKNOWN").describe("e.g. HIGH_INTENT, LOW_INTENT, CHURN_RISK"),
                facts: z.array(z.string()).describe("Distinct actionable facts deduced from this payload"),
            }),
            prompt: `We are the BasaltCRM Synthesis Layer. Deduce context from this latest state mutation.\nRoute: ${method} ${path}\nPayload: ${JSON.stringify(payload)}`,
        });

        // Log token usage (for cost tracking)
        await logAiUsage({
            teamId: payload.tenant_id || payload.team_id || null, // Best effort
            userId: null, 
            service: "analysis",
            model: "system_model",
            usage: usage as any,
            description: "Synthesis Layer Webhook Fact Extraction"
        });

        let contextNodeId: string | null = null;

        // If we found an identifiable entity, tie it to the State Memory 
        if (accountId || leadId) {
            const existingNode = await prismadb.contextNode.findFirst({
                where: {
                    OR: [
                        { accountId: accountId ?? undefined },
                        { leadId: leadId ?? undefined }
                    ]
                }
            });

            if (existingNode) {
                const updated = await prismadb.contextNode.update({
                    where: { id: existingNode.id },
                    data: {
                        summary: object.summary,
                        lifecycleStatus: object.lifecycleStatus || existingNode.lifecycleStatus,
                        sentimentScore: object.sentimentScore !== undefined ? object.sentimentScore : existingNode.sentimentScore,
                        intentLevel: object.intentLevel !== "UNKNOWN" ? object.intentLevel : existingNode.intentLevel,
                    }
                });
                contextNodeId = updated.id;
            } else {
                const created = await prismadb.contextNode.create({
                    data: {
                        accountId,
                        leadId,
                        summary: object.summary,
                        lifecycleStatus: object.lifecycleStatus,
                        sentimentScore: object.sentimentScore,
                        intentLevel: object.intentLevel,
                    }
                });
                contextNodeId = created.id;
            }

            for (const fact of object.facts) {
                const signal = await prismadb.knowledgeSignal.create({
                    data: {
                        contextNodeId,
                        accountId,
                        leadId,
                        type: "FACT",
                        content: fact,
                        confidence: 0.9,
                        sourceType: "MUTATION_HOOK",
                        sourceUrl: path,
                    }
                });

                // Generate vector so agents can retrieve this specific fact
                if (process.env.OPENAI_API_KEY) {
                    try {
                        const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                input: fact,
                                model: "text-embedding-3-small"
                            })
                        });
                        const embedData = await embedRes.json();
                        if (embedData?.data?.[0]?.embedding) {
                            await prismadb.vectorEmbedding.create({
                                data: {
                                    embedding: embedData.data[0].embedding,
                                    text: fact,
                                    contextNodeId,
                                    knowledgeSignalId: signal.id
                                }
                            });
                        }
                    } catch (err) {
                        systemLogger.error("[VectorEmbedding Error]", err);
                    }
                }
            }
        }

        return NextResponse.json({ success: true, contextNodeId });
    } catch (error) {
        systemLogger.error("[SynthesisHookError]", error);
        return NextResponse.json({ error: "Internal Synthesis Error" }, { status: 500 });
    }
}
