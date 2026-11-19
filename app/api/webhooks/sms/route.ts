import { NextResponse } from "next/server";
import { prismadb } from "@/lib/prisma";
import { getAiSdkModel, logAiUsage } from "@/lib/varuni";
import { generateObject } from "ai";
import { z } from "zod";
import { sendSmsEum } from "@/lib/aws/eum-sms";
import { sendEmailSES } from "@/lib/aws/ses";
import { systemLogger } from "@/lib/logger";
import { verifyAndConfirmSnsRequest } from "@/lib/security/sns-verify";

/**
 * POST /api/webhooks/sms
 *
 * Target webhook for AWS End User Messaging (EUM) incoming SMS.
 * AWS posts a JSON payload to this endpoint via SNS HTTP subscription.
 *
 * Workflow:
 * 1. Verifies the incoming SNS notification.
 * 2. Extracts phone number and message body.
 * 3. Identifies the lead/tenant by matching the phone number in our DB.
 * 4. Checks the tenant's exact configuration (teamEumIdentity) for compliance.
 * 5. Uses AI to analyze the inbound message and past history (from Lead_Activities).
 * 6. "Auto-responds" or "Drafts for human review" depending on tenant's settings.
 */

// Simple AI Instruction for the auto-responder
function inboundAiInstruction() {
  return [
    "You are a helpful AI assistant managing customer inquiries for an SDR.",
    "Based on the user's latest message and previous history, draft a concise, conversational reply.",
    "Return ONLY JSON with the keys 'response' and 'shouldAutoRespond' (boolean).",
    "If you are unsure or the topic requires human intervention (billing issue, complex support), set shouldAutoRespond to false.",
    "Constraints: 160-320 characters max. Plain text only.",
  ].join(" ");
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const snsCheck = await verifyAndConfirmSnsRequest(rawBody);
    if (!snsCheck.valid) {
      systemLogger.warn("[AWS_EUM_WEBHOOK] Rejected unverified SNS request:", snsCheck.error);
      return NextResponse.json({ error: snsCheck.error || "Unauthorized" }, { status: 401 });
    }
    if (snsCheck.confirmed) {
      systemLogger.info("[AWS_EUM_WEBHOOK] Confirmed SNS subscription.");
      return NextResponse.json({ success: true, confirmed: true });
    }

    const snsPayload = snsCheck.payload!;
    if (snsPayload.Type !== "Notification") {
      return NextResponse.json({ success: true });
    }

    let payload: any;
    try {
      payload =
        typeof snsPayload.Message === "string"
          ? JSON.parse(snsPayload.Message)
          : snsPayload.Message;
    } catch {
      return new NextResponse("Invalid SNS Message JSON", { status: 400 });
    }

    // AWS EUM Inbound Payload format
    const inboundMessage = payload.messageBody;
    const originationNumber = payload.originationNumber; // The person who sent the text (Lead)
    const destinationNumber = payload.destinationNumber; // The number it was sent to (Tenant)

    if (!inboundMessage || !originationNumber || !destinationNumber) {
      return new NextResponse("Missing required AWS EUM payload fields", {
        status: 400,
      });
    }

    // 1. Identify Tenant and multi-tenant capabilities
    const teamSmsConfig = await prismadb.teamSmsConfig.findFirst({
      where: { phone_number: destinationNumber, sms_enabled: true },
    });

    if (!teamSmsConfig) {
      systemLogger.warn(
        "[AWS_EUM_WEBHOOK] Dropping inbound SMS. No active tenant found for destination:",
        destinationNumber,
      );
      return new NextResponse("OK", { status: 200 }); // Return 200 so AWS doesn't retry infinitely
    }

    const teamId = teamSmsConfig.team_id;

    // 2. Identify Lead within that tenant
    // Extract last 10 digits for a looser match since formatting can vary between platforms
    const phoneDigits = originationNumber.replace(/\D/g, "").slice(-10);

    // Prisma doesn't support regex search easily on strings with findFirst, so we fetch all leads with a phone for this team and find a match
    const teamLeads = await prismadb.crm_Leads.findMany({
      where: { team_id: teamId },
    });

    const lead = teamLeads.find((l: any) => {
      if (!l.phone) return false;
      return l.phone.replace(/\D/g, "").slice(-10) === phoneDigits;
    });

    if (!lead) {
      systemLogger.warn(
        "[AWS_EUM_WEBHOOK] Dropping inbound SMS. No lead found for number:",
        originationNumber,
      );
      return new NextResponse("OK", { status: 200 });
    }

    // Find the user context (who owns the lead) to use their API keys / overrides
    const userId = lead.assigned_to || "system";

    // 3. Log inbound activity to the CRM Lead Timeline
    await prismadb.crm_Lead_Activities.create({
      data: {
        lead: lead.id,
        user: userId !== "system" ? userId : null,
        type: "sms_received",
        metadata: {
          from: originationNumber,
          to: destinationNumber,
          body: inboundMessage,
          provider: "AWS_EUM",
        } as any,
      },
    });

    // 4. Fetch recent history to provide AI context
    const recentHistory = await prismadb.crm_Lead_Activities.findMany({
      where: {
        lead: lead.id,
        type: { in: ["sms_sent", "sms_received"] },
      },
      orderBy: { created_on: "desc" },
      take: 5,
    });

    const conversationText = recentHistory
      .reverse()
      .map((h: any) => {
        const m = h.metadata as any;
        return `${h.type === "sms_received" ? "Lead" : "SDR"}: ${m?.body || "N/A"}`;
      })
      .join("\n");

    // 5. Query the Scalable AI Brain
    const { model, provider, modelId } = await getAiSdkModel(
      userId === "system" ? "system" : userId,
      "sms",
    );
    if (!model) {
      systemLogger.error(
        "[AWS_EUM_WEBHOOK] Tenant has no AI model configured for SMS responses.",
      );
      return new NextResponse("OK", { status: 200 });
    }

    const prompt = `
Lead Profile: ${lead.firstName || ""} ${lead.lastName || ""} from ${lead.company || "Unknown Company"}.
Recent Conversation History:
${conversationText}

Latest Inbound Message: "${inboundMessage}"
`;

    try {
      const { object, usage } = await generateObject({
        model,
        schema: z.object({
          response: z.string(),
          shouldAutoRespond: z.boolean(),
        }),
        messages: [
          { role: "system", content: inboundAiInstruction() },
          { role: "user", content: prompt },
        ],
      });

      await logAiUsage({
        teamId,
        userId: userId !== "system" ? userId : null,
        service: "sms",
        model: `${provider}:${modelId}`,
        usage: {
          promptTokens: (usage as any)?.promptTokens || 0,
          completionTokens: (usage as any)?.completionTokens || 0,
        },
        description: `Inbound SMS processing for lead: ${lead.id}`,
      });

      // 6. Act on the AI determination
      const finalBody = object.response;

      // Hardcoded to AI's confidence. You could easily override this by checking if the team config mandates Human-in-the-Loop
      const runAutoRespond = object.shouldAutoRespond;

      if (runAutoRespond) {
        // Auto-send the SMS out
        try {
          const sendRes = await sendSmsEum({
            to: originationNumber,
            body: finalBody,
            teamEumIdentity: teamSmsConfig.phone_number || undefined,
            messageType: "TRANSACTIONAL",
          });

          const msgId = sendRes.results[originationNumber]?.messageId;

          await prismadb.crm_Lead_Activities.create({
            data: {
              lead: lead.id,
              user: userId !== "system" ? userId : null,
              type: "sms_sent",
              metadata: {
                to: originationNumber,
                body: finalBody,
                messageId: msgId,
                provider: "AWS_EUM",
                agent: "AI_AUTO_RESPONDER",
              } as any,
            },
          });
        } catch (err: any) {
          systemLogger.error("[AWS_EUM_WEBHOOK] Auto-respond failed:", err);
        }
      } else {
        // Draft mode - Needs Human Review
        await prismadb.crm_Lead_Activities.create({
          data: {
            lead: lead.id,
            user: userId !== "system" ? userId : null,
            type: "note",
            metadata: {
              body: `AI drafted response to latest SMS (requires human review): "${finalBody}"`,
              agent: "AI_AUTO_RESPONDER_DRAFT",
            } as any,
          },
        });

        // Route message to Inbox Stream Widget via InternalMessage & Email Alert
        try {
          let notifyUsers =
            userId !== "system"
              ? await prismadb.users.findMany({
                  where: { id: userId },
                  select: { id: true, email: true },
                })
              : await prismadb.users.findMany({
                  where: { team_id: teamId, is_admin: true },
                  select: { id: true, email: true },
                });

          if (!notifyUsers || notifyUsers.length === 0) {
            notifyUsers = await prismadb.users.findMany({
              where: { team_id: teamId },
              select: { id: true, email: true },
            });
          }

          if (notifyUsers.length > 0) {
            // 1. Create Internal Message to trigger the Inbox Stream Widget
            await prismadb.internalMessage.create({
              data: {
                sender_id: lead.id, // Loosely using lead as sender to keep id shape.
                sender_name: `${lead.firstName || "Lead"} ${lead.lastName || ""} (SMS Alert)`,
                subject: "New Inbound SMS requires review",
                body_text: `Customer Message: "${inboundMessage}"\n\nAI drafted response: "${finalBody}"\n\nPlease review and reply from the lead profile.`,
                priority: "URGENT",
                team_id: teamId,
                recipients: {
                  create: notifyUsers.map(
                    (user: { id: string; email: string | null }) => ({
                      recipient_id: user.id,
                      is_read: false,
                    }),
                  ),
                },
              },
            });

            // 2. Send plain text email alert
            for (const u of notifyUsers) {
              if (u.email) {
                await sendEmailSES({
                  to: u.email,
                  subject: `Action Required: Inbound SMS from ${lead.firstName || "Lead"}`,
                  text: `Hello,\n\nA new inbound SMS from ${lead.firstName || "Lead"} ${lead.lastName || ""} (${originationNumber}) requires your attention. The AI drafted a response but marked it for human review.\n\nInbound Message: "${inboundMessage}"\n\nAI Draft: "${finalBody}"\n\nPlease log in to the CRM and check your Inbox Stream or the Lead's timeline to respond.\n\nThank you.`,
                }).catch((err) =>
                  systemLogger.error(
                    "[AWS_EUM_WEBHOOK] Email send failed",
                    err,
                  ),
                );
              }
            }
          }
        } catch (e) {
          systemLogger.error(
            "[AWS_EUM_WEBHOOK] Failed to route draft alert",
            e,
          );
        }
      }
    } catch (autoErr) {
      systemLogger.error("[AWS_EUM_WEBHOOK] AI parsing failed:", autoErr);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (e) {
    systemLogger.error("[AWS_EUM_WEBHOOK] Processing Error:", e);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
