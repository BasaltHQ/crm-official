import { NextResponse } from "next/server";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getSessionAndTeam, validateResourceOwnership } from "@/lib/api-utils";
import { decryptSecret } from "@/lib/encryption";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";
import { isE164 } from "@/lib/twilio/twilio-voice";
import { checkUsageQuota, recordUsage } from "@/lib/usage-quota";
import { requireFeature } from "@/lib/require-feature";

/**
 * POST /api/voice/elevenlabs/outbound
 * 
 * Initiates an outbound call using the ElevenLabs Conversational AI native
 * Twilio integration. ElevenLabs orchestrates Twilio behind the scenes.
 * Looks up lead data and passes dynamic variables inline so the AI agent
 * can personalize the first message without needing a pre-call webhook.
 * 
 * Body: { destination: string; agentId?: string; leadId?: string }
 */

type Body = {
  destination: string;
  agentId?: string;
  leadId?: string;
};

export async function POST(req: Request) {
  const { error, session, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const teamId = teamInfo?.teamId;
  if (!teamId) {
    return NextResponse.json({ ok: false, error: "No team context" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Body;

    // ── Feature Gate (strictly enforced; never skipped) ──
    if (!teamInfo.isPlatformAdmin) {
      const hasVoice = await requireFeature(teamId, "voice");
      if (!hasVoice) {
        return NextResponse.json({ error: "Voice dialing requires a Scale plan or higher" }, { status: 403 });
      }
    }

    if (!body?.destination || !isE164(body.destination)) {
      return NextResponse.json({ ok: false, error: "Invalid destination (must be E.164)" }, { status: 400 });
    }

    // Resolve ElevenLabs credentials + team config in one pass
    let resolvedAgentId = body.agentId || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT || "";
    let resolvedApiKey = process.env.ELEVENLABS_API_KEY || "";
    let agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID || "";
    let brandName = "Basalt CRM";
    let brandContext = "";
    let agentDisplayName = "Darlene"; // Default, overridden by DB

    try {
      const integration = await prismadb.tenant_Integrations.findUnique({
        where: { tenant_id: teamId },
        select: { elevenlabs_api_key: true, elevenlabs_agent_id: true, voice_agent_name: true },
      });
      const decryptedKey = decryptSecret(integration?.elevenlabs_api_key);
      if (decryptedKey) resolvedApiKey = decryptedKey;
      if (integration?.elevenlabs_agent_id) resolvedAgentId = integration.elevenlabs_agent_id;
      if (integration?.voice_agent_name) agentDisplayName = integration.voice_agent_name;

      // Brand info
      const brand = await prismadb.brands.findFirst({
        where: { team_id: teamId },
        select: { brand_label: true, company_name: true, mission_statement: true, core_philosophy: true, tagline: true, description: true, brand_voice: true },
        orderBy: { updatedAt: "desc" },
      });
      if (brand) {
        const label = brand.brand_label || "";
        brandName = (label && label !== "Default Brand") ? label : (brand.company_name || brandName);
        const parts = [];
        if (brand.tagline) parts.push(`Tagline: ${brand.tagline}`);
        if (brand.mission_statement) parts.push(`Mission: ${brand.mission_statement}`);
        if (brand.core_philosophy) parts.push(`Philosophy: ${brand.core_philosophy}`);
        if (brand.description) parts.push(`About: ${brand.description}`);
        if (brand.brand_voice && brand.brand_voice !== "Visionary") parts.push(`Tone: ${brand.brand_voice}`);
        brandContext = parts.join("\n");
      }
    } catch { /* use defaults */ }

    // ── Voice Quota Enforcement ──
    const voiceQuota = await checkUsageQuota(teamId, session?.user?.id || null, "voice");
    if (!voiceQuota.allowed) {
      return NextResponse.json(
        { ok: false, error: voiceQuota.message, remaining: voiceQuota.remaining, limit: voiceQuota.limit },
        { status: 429 }
      );
    }

    if (!resolvedAgentId) {
      return NextResponse.json({ ok: false, error: "Missing ElevenLabs Agent ID" }, { status: 400 });
    }
    if (!resolvedApiKey) {
      return NextResponse.json({ ok: false, error: "Missing ELEVENLABS_API_KEY" }, { status: 500 });
    }

    let dynamicVars: Record<string, string> = {
      lead_first_name: "there",
      lead_last_name: "",
      company_name: brandName,
      company_context: brandContext,
      campaign_context: "a general inquiry",
      business_facts: "",
      agent_name: agentDisplayName,
      campaign_instruction: "",
    };

    // ── Verify explicit leadId ownership BEFORE looking up context ──
    let lead: any = null;
    if (body.leadId) {
      lead = await prismadb.crm_Leads.findUnique({
        where: { id: body.leadId },
        select: {
          id: true, team_id: true, firstName: true, lastName: true, company: true, jobTitle: true,
          phone: true, lead_source: true, campaign: true, description: true,
          pipeline_stage: true, voice_prompt_override: true, email: true,
        },
      });
      if (!lead || !validateResourceOwnership(teamId, lead.team_id, teamInfo.isPlatformAdmin)) {
        return NextResponse.json({ ok: false, error: "Forbidden — lead not found in your team" }, { status: 403 });
      }
    }

    // ── Look up lead + recent activity + campaign prompt ──
    try {
      if (!lead) {
        lead = await prismadb.crm_Leads.findFirst({
          where: {
            team_id: teamId,
            OR: [
              { phone: body.destination },
              { phone: body.destination.replace(/^\+1/, "") },
            ]
          },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true, team_id: true, firstName: true, lastName: true, company: true, jobTitle: true,
            phone: true, lead_source: true, campaign: true, description: true,
            pipeline_stage: true, voice_prompt_override: true, email: true,
          },
        });
      }
      if (lead) {
        // Build business facts
        const facts = [];
        if (lead.company) facts.push(`Lead Company: ${lead.company}`);
        if (lead.jobTitle) facts.push(`Title: ${lead.jobTitle}`);
        if (lead.lead_source) facts.push(`Source: ${lead.lead_source}`);
        if (lead.pipeline_stage) facts.push(`Pipeline Stage: ${lead.pipeline_stage}`);
        if (lead.email) facts.push(`Email: ${lead.email}`);

        // Fetch recent activities for context
        try {
          const activities = await prismadb.crm_Lead_Activities.findMany({
            where: { lead: lead.id },
            orderBy: { createdAt: "desc" },
            take: 5,
            select: { type: true, metadata: true, createdAt: true },
          });
          if (activities.length > 0) {
            const actSummary = activities.map((a: any) => {
              const date = new Date(a.createdAt).toLocaleDateString();
              const meta = typeof a.metadata === "object" && a.metadata ? (a.metadata as any).message || "" : "";
              return `${date}: ${a.type}${meta ? ` — ${meta}` : ""}`;
            }).join("; ");
            facts.push(`Recent Activity: ${actSummary}`);
          }
        } catch { /* skip activities */ }

        // Load campaign voice prompt if available
        let campaignInstruction = lead.voice_prompt_override || "";
        if (!campaignInstruction) {
          try {
            const outreachItem = await prismadb.crm_Outreach_Items.findFirst({
              where: { lead: lead.id, channel: "PHONE" },
              orderBy: { updatedAt: "desc" },
            });
            if (outreachItem?.campaign) {
              const camp = await prismadb.crm_Outreach_Campaigns.findUnique({
                where: { id: outreachItem.campaign },
                select: { voice_prompt: true, name: true },
              });
              if (camp?.voice_prompt) campaignInstruction = camp.voice_prompt;
            }
          } catch { /* skip campaign */ }
        }

        dynamicVars = {
          lead_first_name: lead.firstName || "there",
          lead_last_name: lead.lastName || "",
          company_name: brandName,
          company_context: brandContext,
          campaign_context: lead.campaign || lead.description || "a recent inquiry",
          business_facts: facts.join("\n"),
          agent_name: agentDisplayName,
          campaign_instruction: campaignInstruction || "Your goal is to build rapport, qualify the lead's needs, and schedule a follow-up.",
        };
        systemLogger.info(`[ELEVENLABS_OUTBOUND] Matched lead ${lead.id} — ${lead.firstName} ${lead.lastName}`);
      }
    } catch (lookupErr: any) {
      systemLogger.warn("[ELEVENLABS_OUTBOUND] Lead lookup failed, using defaults:", lookupErr?.message);
    }

    // ── Build ElevenLabs payload ──
    const elevenlabsPayload: Record<string, any> = {
      agent_id: resolvedAgentId,
      to_number: body.destination,
      conversation_initiation_client_data: {
        dynamic_variables: dynamicVars,
      },
    };

    if (agentPhoneNumberId) {
      elevenlabsPayload.agent_phone_number_id = agentPhoneNumberId;
    }

    const res = await fetch("https://api.elevenlabs.io/v1/convai/twilio/outbound_call", {
      method: "POST",
      headers: {
        "xi-api-key": resolvedApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(elevenlabsPayload),
    });

    const responseText = await res.text();
    let data: any = {};
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!res.ok) {
      systemLogger.error(`[ELEVENLABS_OUTBOUND] Failed: ${res.status}`, responseText);
      return NextResponse.json({
        ok: false,
        error: data?.detail || data?.message || `ElevenLabs API returned ${res.status}`,
      }, { status: res.status });
    }

    const callSid = data?.call_sid || data?.callSid || data?.sid || null;
    
    systemLogger.info(`[ELEVENLABS_OUTBOUND] Initiated call to ${body.destination} via Twilio. CallSid: ${callSid}`);

    return NextResponse.json({
      ok: true,
      callSid,
      result: data,
    }, { status: 200 });
  } catch (e: any) {
    systemLogger.error("[ELEVENLABS_OUTBOUND_ERROR]", e);
    return NextResponse.json({
      ok: false,
      error: e?.message || "Outbound call failed",
    }, { status: 500 });
  }
}

