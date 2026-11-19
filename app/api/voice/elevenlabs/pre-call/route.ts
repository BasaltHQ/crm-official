import { NextResponse } from "next/server";
import crypto from "crypto";
import { prismadb as prisma } from "@/lib/prisma";
import { systemLogger } from "@/lib/logger";

const WEBHOOK_TOLERANCE_SECONDS = 300;

function verifyVoiceWebhookAuth(req: Request, rawBody: string, secret: string): boolean {
  // 1. Check ElevenLabs-Signature: "t=<timestamp>,v0=<hmac_sha256_hex>"
  const sigHeader = req.headers.get("elevenlabs-signature");
  if (sigHeader) {
    const parts = sigHeader.split(",").map((p) => p.trim());
    const tPart = parts.find((p) => p.startsWith("t="));
    const v0Parts = parts.filter((p) => p.startsWith("v0="));
    if (tPart && v0Parts.length > 0) {
      const ts = Number(tPart.slice(2));
      if (
        Number.isFinite(ts) &&
        Math.abs(Math.floor(Date.now() / 1000) - ts) <= WEBHOOK_TOLERANCE_SECONDS
      ) {
        const expected = crypto
          .createHmac("sha256", secret)
          .update(`${ts}.${rawBody}`, "utf8")
          .digest();
        for (const v0 of v0Parts) {
          const hex = v0.slice(3);
          if (!/^[0-9a-fA-F]{64}$/.test(hex)) continue;
          const candidate = Buffer.from(hex, "hex");
          if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // 2. Check shared secret header (x-webhook-secret / Authorization: Bearer <secret>)
  const headerSecret =
    req.headers.get("x-webhook-secret")?.trim() ||
    req.headers.get("x-elevenlabs-secret")?.trim() ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    "";
  if (!headerSecret) return false;

  const expectedBuf = Buffer.from(secret, "utf8");
  const providedBuf = Buffer.from(headerSecret, "utf8");
  return (
    expectedBuf.length === providedBuf.length &&
    crypto.timingSafeEqual(expectedBuf, providedBuf)
  );
}

export async function POST(req: Request) {
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET || process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) {
    systemLogger.error("[ELEVENLABS_PRE_CALL] Missing ELEVENLABS_WEBHOOK_SECRET / VOICE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const rawBody = await req.text();
  if (!verifyVoiceWebhookAuth(req, rawBody, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    systemLogger.info("[ELEVENLABS_PRE_CALL_WEBHOOK_RECEIVED]", JSON.stringify(payload));

    // ElevenLabs payload structure includes caller_id, sometimes under 'call' object or root
    const callerId = payload?.caller_id || payload?.call?.caller_id || payload?.call_id;

    if (!callerId) {
      systemLogger.warn("[ELEVENLABS_PRE_CALL] No caller_id found in webhook payload.");
      return NextResponse.json({
        dynamic_variables: {
          lead_first_name: "there",
          lead_last_name: "",
          company_name: "our team",
          campaign_context: "general inquiry",
          business_facts: "We are reaching out to see if you need anything."
        }
      });
    }

    // Try to find the lead in the database using the spoofed caller_id (E.164 phone number)
    // We normalize the phone number search slightly just in case of formatting diffs
    const targetPhone = callerId.startsWith("+") ? callerId : `+${callerId}`;

    const lead = await prisma.crm_Leads.findFirst({
      where: {
        OR: [
          { phone: targetPhone },
          { phone: callerId },
          { phone: callerId.replace(/^\+1/, "") }
        ]
      },
      orderBy: { // Prioritize recently updated leads just in case of duplicates
        updatedAt: 'desc'
      }
    });

    if (lead) {
      systemLogger.info(`[ELEVENLABS_PRE_CALL] Successfully matched caller_id ${callerId} to Lead ID ${lead.id}`);
      
      // Determine the active campaign for this lead to get the voice prompt
      const recentOutreach = await prisma.crm_Outreach_Items.findFirst({
        where: {
          lead: lead.id,
          channel: "PHONE",
        },
        orderBy: { updatedAt: 'desc' },
      });

      let campaignInstruction = lead.voice_prompt_override || "";
      
      // If no lead-specific override exists, fall back to the active campaign prompt
      if (recentOutreach && recentOutreach.campaign && !lead.voice_prompt_override) {
         // Load the campaign
         const campaignParams = await prisma.crm_Outreach_Campaigns.findUnique({
            where: { id: recentOutreach.campaign },
            select: { voice_prompt: true, name: true }
         });
         
         if (campaignParams?.voice_prompt) {
             campaignInstruction = campaignParams.voice_prompt;
             systemLogger.info(`[ELEVENLABS_PRE_CALL] Injected custom voice prompt for campaign: ${campaignParams.name}`);
         }
      }

      return NextResponse.json({
        dynamic_variables: {
          agent_name: "Alex",
          lead_first_name: lead.firstName || "there",
          lead_last_name: lead.lastName || "",
          company_name: "Basalt CRM",
          campaign_context: lead.campaign || lead.description || "a recent inquiry or previous touchpoint",
          business_facts: `Company: ${lead.company || 'Unknown'}\nTitle: ${lead.jobTitle || 'Unknown'}\nLead Source: ${lead.lead_source || 'Direct'}.`,
          campaign_instruction: campaignInstruction || "Your goal is to answer questions and be helpful."
        }
      });
    }
    // Fallback if lead not found by phone
    systemLogger.warn(`[ELEVENLABS_PRE_CALL] Lead not found for caller_id: ${callerId}`);
    return NextResponse.json({
      dynamic_variables: {
        agent_name: "Alex",
        lead_first_name: "there",
        lead_last_name: "",
        company_name: "Basalt CRM",
        campaign_context: "your account",
        business_facts: "No additional context found."
      }
    });

  } catch (error: any) {
    systemLogger.error("[ELEVENLABS_PRE_CALL_ERROR]", error);
    // Even on error, return a valid blank payload so the call doesn't unnecessarily fail
    return NextResponse.json({
      dynamic_variables: {
        agent_name: "the AI assistant",
        lead_first_name: "there",
        company_name: "Basalt CRM",
        campaign_context: "a general check-in"
      }
    });
  }
}
