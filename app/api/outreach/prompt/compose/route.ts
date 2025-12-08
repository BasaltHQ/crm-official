import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getAiSdkModel, isReasoningModel } from "@/lib/openai";
import { generateText } from "ai";

/**
 * POST /api/outreach/prompt/compose
 * Body: {
 *   personaName?: string;
 *   projectRole?: string;
 *   goalKeywords?: string; // short description or keywords, to be expanded
 *   projectId?: string;    // optional, to resolve project briefing
 *   leadId?: string;       // optional, to resolve assigned project from lead
 * }
 *
 * Returns: { prompt: string }
 *
 * Purpose:
 * - Composes a fully fleshed, project-aware outreach PROMPT TEXT using seed inputs.
 * - The inputs are used as seeds; the model must expand and elaborate the Goal and context,
 *   rather than simply copying seed strings verbatim.
 * - The returned text is a prompt intended to be used by another generative model to produce the email.
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const personaName: string = String(body?.personaName || "Krishna Patel").trim();
        const projectRole: string = String(body?.projectRole || "").trim();
        const goalKeywords: string = String(body?.goalKeywords || "").trim();
        const projectId: string | undefined = body?.projectId || undefined;
        const leadId: string | undefined = body?.leadId || undefined;

        // Resolve project briefing (Title/Summary) via projectId or lead.assigned_project
        let projectTitle = "";
        let projectDescription = "";

        if (projectId) {
            try {
                const board = await (prismadb as any).Boards.findUnique({
                    where: { id: projectId },
                    select: { title: true, description: true },
                });
                if (board) {
                    projectTitle = String(board.title || "");
                    projectDescription = String(board.description || "");
                }
            } catch { /* noop */ }
        } else if (leadId) {
            try {
                const lead = await (prismadb as any).crm_Leads.findFirst({
                    where: { id: leadId },
                    include: { assigned_project: true },
                });
                const assigned = (lead as any)?.assigned_project;
                if (assigned) {
                    projectTitle = String(assigned?.title || "");
                    projectDescription = String(assigned?.description || "");
                }
            } catch { /* noop */ }
        }

        // Build seed context to send to the model for prompt composition
        const seedContext = {
            personaName,
            projectRole,
            goalKeywords,
            projectBriefing: {
                title: projectTitle,
                summary: projectDescription,
            },
        };

        const model = await getAiSdkModel(session.user.id);
        if (!model) {
            return new NextResponse("AI model not configured", { status: 500 });
        }

        // System instructions for composing a PROMPT TEXT from seed inputs.
        const system = [
            "You are an expert prompt engineer for SDR first-contact outreach.",
            "Task: Compose a SINGLE cohesive PROMPT TEXT that will be given to a generative model to produce a personalized outreach email.",
            "Use the provided seeds (personaName, projectRole, goalKeywords, projectBriefing) to EXPAND and ELABORATE the Goal and context.",
            "Do not simply copy seed strings verbatim; add detail, specificity, and clear instructions.",
            "Constraints:",
            "- The prompt must be plain text only (no JSON).",
            "- Single-recipient orientation (no pool or batch context, no IDs).",
            "- Instruct the email generator to write in first person as the specified persona.",
            "- Include a brief Project Briefing section only if title/summary is available.",
            "- Include clear voice/style and requirements similar to vcrun.py, but adapted.",
            "- Keep it focused and actionable.",
        ].join(" ");

        const user = [
            "Seeds:",
            JSON.stringify(seedContext, null, 2),
            "",
            "Compose the final PROMPT TEXT now. It should:",
            "- Begin with a Persona instruction using personaName and projectRole (e.g., “You are <name> — <role> at <project>…”).",
            "- Include a Goal section that EXPANDS the goalKeywords into 2–3 detailed sentences.",
            "- Include Project Briefing (Title and Summary) IF available.",
            "- Include Voice and Style and Requirements sections suitable for guiding the email generator.",
            "- Avoid any mention of IDs, pools, or batch context.",
            "- Return ONLY the prompt text (no JSON).",
        ].join("\n");

        let promptText = "";
        try {
            const { text } = await generateText({
                model,
                system,
                prompt: user,
                temperature: isReasoningModel(model.modelId) ? undefined : 1,
            });
            promptText = text.trim();
        } catch (err: any) {
            // eslint-disable-next-line no-console
            console.error("[OUTREACH_PROMPT_COMPOSE][AI_ERROR]", err?.message || err);
            // Fallback: compose a deterministic prompt locally if model fails
            const roleSuffix = (projectRole || projectTitle)
                ? ` — ${[projectRole, projectTitle ? `at ${projectTitle}` : ""].filter(Boolean).join(" ")}`
                : "";
            const personaLine = `Persona:\nYou are ${personaName}${roleSuffix}. Write entirely in first person (I/me); never refer to yourself in third person. Your voice is principled builder, analytical and candid, confident but not salesy.`;

            const expandedGoal = goalKeywords
                ? `Expand on the following goal keywords: ${goalKeywords}. Provide a concise, 2–3 sentence objective focusing on personalization and strategic clarity.`
                : "Craft a personalized outreach email tailored to the recipient, using any available firm/company research. Provide a concise, 2–3 sentence objective focusing on personalization and strategic clarity.";

            const projectBlock =
                (projectTitle || projectDescription)
                    ? `\n\nProject Briefing:\n- Title: ${projectTitle}\n- Summary: ${projectDescription}`
                    : "";

            const styleAndReqs = `
\n\nVoice and Style:
- Narrative, insight-driven prose; no section headings or bullet points in the email body.
- Avoid phrases like "Founder note".
- Be concise, confident, and specific; show operator depth and strategic clarity.

Requirements:
- Output JSON ONLY with keys "subject" and "body". Example: {"subject":"...","body":"..."}
- Body MUST be plain text (no HTML, signature, resources section, footers, or disclaimers).
- Length: 250–300 words.
- Open with a hook tied to their thesis/portfolio using available research.
- Personalize: connect the project’s value to their focus; demonstrate homework.
- Maintain first-person voice throughout (I/me). No third-person references to ${personaName.split(" ")[0] || "the author"}.
- No explicit headings; write as natural prose paragraphs.
- End with a confident CTA that mentions remote availability and the Santa Fe location.
`.trim();

            promptText = [personaLine, `\n\nGoal:\n${expandedGoal}`, projectBlock, `\n\n${styleAndReqs}`]
                .filter(Boolean)
                .join("");
        }

        if (!promptText || !promptText.trim().length) {
            return new NextResponse("Failed to compose prompt", { status: 500 });
        }

        return NextResponse.json({ prompt: promptText }, { status: 200 });
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error("[OUTREACH_PROMPT_COMPOSE_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
