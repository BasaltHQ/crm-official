import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { requirePlatformAdminApi } from "@/lib/api-auth-guard";
import { getSessionAndTeam } from "@/lib/api-utils";
import { decryptSecret } from "@/lib/encryption";
import { prismadb } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

const ELEVENLABS_API_KEY = () => process.env.ELEVENLABS_API_KEY || "";
const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/convai/agents";

function buildHeaders(apiKey: string) {
  return {
    "xi-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

/**
 * GET /api/voice/elevenlabs/agent-config?agentId=xxx
 * Fetch the current agent configuration from ElevenLabs.
 * Platform admins can inspect global or specified agentId; tenant users may ONLY read
 * their own tenant's configured elevenlabs_agent_id using their own decrypted elevenlabs_api_key.
 */
export async function GET(req: Request) {
  const { error, teamInfo } = await getSessionAndTeam();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const requestedAgentId = searchParams.get("agentId")?.trim() || null;

  let agentId: string | null = null;
  let apiKey: string | null = null;

  if (teamInfo!.isPlatformAdmin) {
    agentId = requestedAgentId || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT || null;
    apiKey = ELEVENLABS_API_KEY() || null;
  } else {
    if (!teamInfo?.teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const integration = await prismadb.tenant_Integrations.findUnique({
      where: { tenant_id: teamInfo.teamId },
      select: { elevenlabs_agent_id: true, elevenlabs_api_key: true },
    });
    const tenantAgentId = integration?.elevenlabs_agent_id?.trim() || null;
    const tenantApiKey = decryptSecret(integration?.elevenlabs_api_key);
    if (!tenantAgentId || !tenantApiKey) {
      return NextResponse.json(
        { error: "Forbidden — tenant ElevenLabs agent and API key must be configured" },
        { status: 403 }
      );
    }
    if (requestedAgentId && requestedAgentId !== tenantAgentId) {
      return NextResponse.json({ error: "Forbidden — agentId mismatch" }, { status: 403 });
    }
    agentId = tenantAgentId;
    apiKey = tenantApiKey;
  }

  if (!agentId || !/^[a-zA-Z0-9_-]+$/.test(agentId)) {
    return NextResponse.json({ error: "No valid agent ID" }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ElevenLabs API key" }, { status: 500 });
  }

  try {
    const res = await fetch(`${ELEVENLABS_BASE}/${encodeURIComponent(agentId)}`, {
      method: "GET",
      headers: buildHeaders(apiKey),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: (data as any)?.detail || `API ${res.status}` }, { status: res.status });
    }

    // Extract the relevant config fields
    const config = (data as any)?.conversation_config || {};
    const agent = config?.agent || {};
    const tts = config?.tts || {};

    return NextResponse.json({
      agentId,
      name: (data as any)?.name || "",
      system_prompt: agent?.prompt?.prompt || "",
      first_message: agent?.first_message || "",
      language: agent?.language || "en",
      voice_id: tts?.voice_id || "",
      model_id: tts?.model_id || "",
      stability: tts?.stability,
      similarity_boost: tts?.similarity_boost,
      speed: tts?.speed,
      // Pass through full raw for reference
      _raw: data,
    });
  } catch (e: any) {
    systemLogger.error("[AGENT_CONFIG_GET]", e?.message || e);
    return NextResponse.json({ error: e?.message || "Failed to fetch agent" }, { status: 500 });
  }
}

/**
 * PATCH /api/voice/elevenlabs/agent-config
 * Update the agent configuration on ElevenLabs.
 * 
 * Body: { agentId?, system_prompt?, first_message?, voice_id?, stability?, similarity_boost?, speed? }
 */
export async function PATCH(req: Request) {
  const session = await requirePlatformAdminApi();
  if (session instanceof Response) return session;

  if (!ELEVENLABS_API_KEY()) {
    return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const agentId = body?.agentId || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT;
    if (!agentId || !/^[a-zA-Z0-9_-]+$/.test(String(agentId))) {
      return NextResponse.json({ error: "No valid agent ID" }, { status: 400 });
    }

    // Build the nested update payload — only include fields that were provided
    const patch: Record<string, any> = {};
    const conversationConfig: Record<string, any> = {};
    const agentConfig: Record<string, any> = {};
    const ttsConfig: Record<string, any> = {};

    if (body.system_prompt !== undefined) {
      agentConfig.prompt = { prompt: body.system_prompt };
    }
    if (body.first_message !== undefined) {
      agentConfig.first_message = body.first_message;
    }
    if (body.language !== undefined) {
      agentConfig.language = body.language;
    }

    if (body.voice_id !== undefined) ttsConfig.voice_id = body.voice_id;
    if (body.model_id !== undefined) ttsConfig.model_id = body.model_id;
    if (body.stability !== undefined) ttsConfig.stability = body.stability;
    if (body.similarity_boost !== undefined) ttsConfig.similarity_boost = body.similarity_boost;
    if (body.speed !== undefined) ttsConfig.speed = body.speed;

    if (Object.keys(agentConfig).length > 0) {
      conversationConfig.agent = agentConfig;
    }
    if (Object.keys(ttsConfig).length > 0) {
      conversationConfig.tts = ttsConfig;
    }
    if (Object.keys(conversationConfig).length > 0) {
      patch.conversation_config = conversationConfig;
    }

    if (body.name !== undefined) {
      patch.name = body.name;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    systemLogger.info(`[AGENT_CONFIG_PATCH] Updating agent ${agentId}: ${JSON.stringify(patch)}`);

    const res = await fetch(`${ELEVENLABS_BASE}/${encodeURIComponent(String(agentId))}`, {
      method: "PATCH",
      headers: buildHeaders(ELEVENLABS_API_KEY()),
      body: JSON.stringify(patch),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      systemLogger.error(`[AGENT_CONFIG_PATCH] Failed ${res.status}: ${JSON.stringify(data)}`);
      return NextResponse.json({ error: (data as any)?.detail || `API ${res.status}` }, { status: res.status });
    }

    return NextResponse.json({ ok: true, agentId, result: data });
  } catch (e: any) {
    systemLogger.error("[AGENT_CONFIG_PATCH]", e?.message || e);
    return NextResponse.json({ error: e?.message || "Failed to update agent" }, { status: 500 });
  }
}
