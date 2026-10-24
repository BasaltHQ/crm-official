import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { systemLogger } from "../logger";
import { buildReplyDecisionState, deriveReplyDecision, ReplyDecisionResponseSchema,
  REPLY_QUESTION_VERSION, REPLY_QUESTIONS, REPLY_TEXT_LIMIT, REPLY_POLICY_VERSION,
  type ReplyDecisionContext } from "./reply-decisions";
import { createTypeSafeClient, evaluateTypeSafe, TYPESAFE_MODEL,
  TYPESAFE_INPUT_PRICE_PER_MILLION, type TypeSafeAttempt } from "./typesafe-client";

export interface ReplyDecisionScope {
  teamId?: string | null;
  outreachItemId: string;
  messageId?: string;
  provider: "ses" | "gmail";
}

interface ReplyInput extends ReplyDecisionScope {
  userId: string;
  reply: string;
  context: ReplyDecisionContext;
}

type Decision = ReturnType<typeof deriveReplyDecision>;
type State = ReturnType<typeof buildReplyDecisionState>;
interface Dependencies {
  resolveTeam: (userId: string) => Promise<string | null>;
  cached: (teamId: string, description: string) => Promise<{ metadata: unknown } | null>;
  evaluate: (key: string, state: State, onAttempt: (attempt: TypeSafeAttempt) => void) => Promise<unknown>;
  persist: (data: Prisma.crm_AiUsageLogUncheckedCreateInput) => Promise<unknown>;
  warn: (phase: "evaluation" | "telemetry", audit?: Prisma.InputJsonObject) => void;
}

const dependencies: Dependencies = {
  resolveTeam: async userId => {
    const { prismadb } = await import("../prisma");
    return (await prismadb.users.findUnique({ where: { id: userId }, select: { team_id: true } }))?.team_id || null;
  },
  cached: async (teamId, description) => {
    const { prismadb } = await import("../prisma");
    return prismadb.crm_AiUsageLog.findFirst({
      where: { tenant_id: teamId, service: "reply_decision", description }, select: { metadata: true },
    });
  },
  evaluate: (key, state, onAttempt) => evaluateTypeSafe(createTypeSafeClient(key, undefined, onAttempt), state, REPLY_QUESTIONS),
  persist: async data => {
    const { prismadb } = await import("../prisma");
    return prismadb.crm_AiUsageLog.create({ data });
  },
  // Never log provider error text, email content, or credentials.
  warn: (phase, audit) => systemLogger.warn("[REPLY_INTELLIGENCE] Evaluation or telemetry unavailable", { phase, audit }),
};

const objectId = /^[a-f\d]{24}$/i;
const inFlight = new Map<string, Promise<Decision | undefined>>();

/** Included for every team. Credentials are platform configuration, not an entitlement. */
export async function evaluateReplyIntelligence(
  input: ReplyInput,
  deps: Dependencies = dependencies,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<Decision | undefined> {
  const teamId = input.teamId;
  if (!teamId || !objectId.test(teamId) || !objectId.test(input.userId) ||
    !objectId.test(input.outreachItemId) || !input.messageId || input.messageId.length > 256 ||
    input.reply.trim().length < 5) return undefined;
  try {
    if (await deps.resolveTeam(input.userId) !== teamId) return undefined;
  } catch {
    deps.warn("evaluation");
    return undefined;
  }
  const state = buildReplyDecisionState(input.reply, input.context);
  const stateHash = createHash("sha256").update(JSON.stringify(state)).digest("hex");
  const source = { provider: input.provider, messageId: input.messageId, outreachItemId: input.outreachItemId };
  const evaluationKey = createHash("sha256").update(JSON.stringify({
    teamId, source, stateHash, model: TYPESAFE_MODEL, questionVersion: REPLY_QUESTION_VERSION,
  })).digest("hex");
  const existing = inFlight.get(evaluationKey);
  if (existing) return existing;
  const description = `Reply decision: ${evaluationKey}`;
  const run = async (): Promise<Decision | undefined> => {
    const startedAt = Date.now();
    const attempts: TypeSafeAttempt[] = [];
    let usage = { input_tokens: 0, output_tokens: 0 };
    let usageKnown = false;
    let response: unknown;
    let model = TYPESAFE_MODEL;
    const record = async (service: string, metadata: Prisma.InputJsonObject) => {
      const cost = usageKnown && model === TYPESAFE_MODEL ? usage.input_tokens * TYPESAFE_INPUT_PRICE_PER_MILLION / 1_000_000 : 0;
      try {
        await deps.persist({ tenant_id: teamId, user_id: input.userId, service, model_used: model,
          tokens_in: usage.input_tokens, tokens_out: usage.output_tokens,
          cost,
          description,
          metadata: { mode: "primary", billable: false, evaluationKey, questionVersion: REPLY_QUESTION_VERSION,
            policyVersion: REPLY_POLICY_VERSION, stateHash, source, inputTruncated: input.reply.length > REPLY_TEXT_LIMIT,
            attempts: attempts.map(attempt => ({ ...attempt })), attemptCount: attempts.length,
            latencyMs: Date.now() - startedAt, usageKnown,
            costKnown: usageKnown && model === TYPESAFE_MODEL, ...metadata },
        });
      } catch {
        // Preserve accounting evidence in server logs when the database write fails.
        deps.warn("telemetry", { evaluationKey, teamId, service, model, tokensIn: usage.input_tokens,
          tokensOut: usage.output_tokens, cost, usageKnown, attemptCount: attempts.length });
      }
    };
    try {
      // Cache only successful results for this tenant, source, exact state, model, and rubric.
      let cached: Awaited<ReturnType<Dependencies["cached"]>> = null;
      try { cached = await deps.cached(teamId, description); } catch { deps.warn("telemetry"); }
      const parsedCache = ReplyDecisionResponseSchema.safeParse((cached?.metadata as { response?: unknown } | null)?.response);
      if (parsedCache.success && parsedCache.data.model === TYPESAFE_MODEL) {
        const result = deriveReplyDecision(parsedCache.data);
        usageKnown = true;
        await record("reply_decision_cache", { status: "cached", decision: result.decision });
        return result;
      }
      const apiKey = env.TYPESAFE_API_KEY?.trim();
      if (!apiKey) {
        await record("reply_decision_unavailable", { status: "unavailable", errorCode: "not_configured", fallbackUsed: true });
        return undefined;
      }
      response = await deps.evaluate(apiKey, state, attempt => attempts.push(attempt));
      const raw = response as { model?: unknown; usage?: unknown } | null;
      if (typeof raw?.model === "string") model = raw.model.slice(0, 100);
      const parsedUsage = ReplyDecisionResponseSchema.shape.usage.safeParse(raw?.usage);
      if (parsedUsage.success) { usage = parsedUsage.data; usageKnown = true; }
      const validated = ReplyDecisionResponseSchema.safeParse(response);
      if (!validated.success || validated.data.model !== TYPESAFE_MODEL) {
        await record("reply_decision_error", { status: "failed", errorCode: "invalid_response", fallbackUsed: true });
        return undefined;
      }
      const result = deriveReplyDecision(validated.data);
      await record("reply_decision", { status: "succeeded", fallbackUsed: false,
        requiresReview: result.decision.requiresReview, decision: result.decision, response: validated.data });
      return result;
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : null;
      const errorCode = status === 429 ? "rate_limit" : status === 401 || status === 403 ? "authentication" :
        status ? "provider_error" : "transport_or_timeout";
      await record("reply_decision_error", { status: "failed", errorCode, httpStatus: status, fallbackUsed: true });
      deps.warn("evaluation");
      return undefined;
    }
  };
  const promise = run();
  inFlight.set(evaluationKey, promise);
  try { return await promise; } finally { inFlight.delete(evaluationKey); }
}
