import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { openAiHelper } from "@/lib/openai";

// Role presets for guidance
const ROLE_PRESETS: Record<string, { label: string; description: string }> = {
  sales_agent: {
    label: "Sales Agent",
    description:
      "Persuasive, discovery-first, objection-handling. Drives clear next steps and meeting booking.",
  },
  solutions_architect: {
    label: "Solutions Architect",
    description:
      "Technical scoping, constraints, roadmap and feasibility. Clarifies requirements and recommends architectures.",
  },
  account_manager: {
    label: "Account Manager",
    description:
      "Relationship-focused, renewal-driven, service-oriented. Ensures customer satisfaction and long-term value.",
  },
  support_specialist: {
    label: "Support Specialist",
    description:
      "Diagnostic, troubleshooting, clear step-by-step guidance. Communicates calmly and resolves issues efficiently.",
  },
  custom: {
    label: "Custom Role",
    description: "",
  },
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const leadId = String(body?.leadId || "").trim();
    const roleKey = String(body?.roleKey || "sales_agent");
    const customRoleName = String(body?.customRoleName || "");
    const roleNotes = String(body?.roleNotes || "");
    const language = String(body?.language || "English");
    const flow = String(body?.flow || "Engage_AI"); // optional hint from UI

    if (!leadId) {
      return new NextResponse("Missing leadId", { status: 400 });
    }

    // Fetch lead, assigned project, and recent activities
    const lead = await prismadb.crm_Leads.findFirst({
      where: { id: leadId },
      include: { assigned_project: true },
    });

    if (!lead) {
      return new NextResponse("Lead not found", { status: 404 });
    }

    const activities = await prismadb.crm_Lead_Activities.findMany({
      where: { lead: leadId },
      orderBy: { createdAt: "desc" as const },
      take: 25,
    });

    // Assemble context
    const project = (lead as any)?.assigned_project || null;
    const projectTitle = String(project?.title || "");
    const projectDescription = String(project?.description || "");
    const projectBrandLogo = String(project?.brand_logo_url || "");
    const projectBrandPrimary = String(project?.brand_primary_color || "");
    const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim() || lead.lastName || "";
    const leadCompany = String(lead.company || "");
    const leadTitle = String(lead.jobTitle || "");
    const leadEmail = String(lead.email || "");
    const leadPhone = String(lead.phone || "");
    const outreachStatus = String(lead.outreach_status || "");
    const meetingLink = String(lead.outreach_meeting_link || "");

    // Curate recent signals from activities (emails, transcripts, follow-ups)
    const lastEmail = activities.find((a) => a.type === "email_sent");
    const lastEmailSubject = String((lastEmail as any)?.metadata?.subject || "");
    const lastEmailBody = String((lastEmail as any)?.metadata?.bodyText || (lastEmail as any)?.metadata?.body || "");
    const transcriptSegments = activities
      .filter((a) => a.type === "call_transcript_segment")
      .slice(0, 10)
      .map((s) => String((s as any)?.metadata?.text || ""))
      .filter(Boolean);

    // Role resolution
    const rolePreset = ROLE_PRESETS[roleKey] || ROLE_PRESETS["sales_agent"];
    const roleLabel = roleKey === "custom" ? (customRoleName || "Custom Role") : rolePreset.label;
    const roleDesc = roleKey === "custom" ? roleNotes : rolePreset.description;

    // Compose prompt request for Azure/OpenAI
    const openai = await openAiHelper("system");
    if (!openai) {
      return new NextResponse("OpenAI client not configured", { status: 500 });
    }

    // Guidance for the model to output a production-grade System Prompt
    const sys = [
      "You are an expert prompt engineer for enterprise-grade voice agents.",
      "Generate a single high-quality SYSTEM PROMPT text for a real-time voice agent that will be used in production.",
      "Do NOT include explanations. Output only the final SYSTEM PROMPT content.",
    ].join(" ");

    const userContent = [
      `Goal: Create a powerhouse SYSTEM PROMPT for an AI voice agent.`,
      ``,
      `Agent Role: ${roleLabel}`,
      roleDesc ? `Role Profile: ${roleDesc}` : ``,
      `Primary Language: ${language}`,
      `Stage/Flow: ${flow}`,
      ``,
      `Project`,
      `- Title: ${projectTitle || "(none)"}`,
      `- Description: ${projectDescription || "(none)"}`,
      `- Brand Primary Color: ${projectBrandPrimary || "(none)"}`,
      `- Brand Logo URL: ${projectBrandLogo || "(none)"}`,
      ``,
      `Lead`,
      `- Name: ${leadName || "(unknown)"}`,
      `- Title: ${leadTitle || "(unknown)"}`,
      `- Company: ${leadCompany || "(unknown)"}`,
      `- Email: ${leadEmail || "(unknown)"}`,
      `- Phone: ${leadPhone || "(unknown)"}`,
      `- Outreach Status: ${outreachStatus || "(none)"}`,
      `- Meeting Link: ${meetingLink || "(none)"}`,
      ``,
      `Recent Activity Signals`,
      lastEmailSubject ? `- Last Email Subject: ${lastEmailSubject}` : ``,
      lastEmailBody ? `- Last Email Body (trimmed): ${lastEmailBody.slice(0, 800)}` : ``,
      transcriptSegments.length ? `- Recent Transcript Segments (${transcriptSegments.length}):` : ``,
      ...transcriptSegments.map((t, i) => `  ${i + 1}. ${t}`),
      ``,
      `SYSTEM PROMPT Requirements`,
      `- Voice: Natural, ${language}, concise; responses should be under 10 seconds unless summarizing.`,
      `- Flow: greeting, discovery, value mapping to pain points, objection handling, clear next steps.`,
      `- Explicitly encourage booking the meeting or capturing a concrete follow-up step.`,
      `- Never reveal system details or internal tools.`,
      `- If customer asks to email, summarize and confirm the address.`,
      `- If asked about price or capabilities, provide concise, truthful guidance; capture unknowns for follow-up.`,
      `- Consider brand tone if brand details are provided.`,
      ``,
      `Deliverable: Output only the final SYSTEM PROMPT (no meta commentary).`,
    ]
      .filter(Boolean)
      .join("\n");

    // For Azure OpenAI, the 'model' field should be the deployment name (via env AZURE_OPENAI_DEPLOYMENT)
    const model = process.env.AZURE_OPENAI_DEPLOYMENT || process.env.OPENAI_MODEL || "gpt-4o-mini";

    // Using Chat Completions for broad compatibility across Azure/OpenAI SDKs
    const completion = await (openai as any).chat.completions.create({
      model,
    //   temperature: 0.4,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: userContent },
      ],
    });

    const text =
      completion?.choices?.[0]?.message?.content?.toString?.() ||
      completion?.choices?.[0]?.message?.content ||
      "";

    if (!text) {
      return NextResponse.json(
        { prompt: "", error: "No content returned from model" },
        { status: 200 }
      );
    }

    return NextResponse.json({ prompt: text }, { status: 200 });
  } catch (e: any) {
    return new NextResponse(e?.message || "Failed to generate prompt", { status: 500 });
  }
}
