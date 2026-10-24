import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { buildReplyDecisionState, deriveReplyDecision, ReplyDecisionResponseSchema,
  REPLY_INTENTS, REPLY_QUESTIONS, DECISION_SERVICES } from "../../lib/ai/reply-decisions";
import { evaluateReplyIntelligence } from "../../lib/ai/reply-intelligence";
import { createTypeSafeClient, evaluateTypeSafe, TYPESAFE_MODEL, type TypeSafeAttempt } from "../../lib/ai/typesafe-client";
import { DecisionAccessError, getDecisionReport } from "../../lib/ai/decision-report";

const teamId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const otherTeam = "dddddddddddddddddddddddd";
const input = {
  teamId, userId: "bbbbbbbbbbbbbbbbbbbbbbbb", outreachItemId: "cccccccccccccccccccccccc",
  messageId: "reply-123", provider: "ses" as const, reply: "Can we schedule a demo and get pricing?",
  context: { originalSubject: "Private offer", leadName: "Private person" },
};
const env = { TYPESAFE_API_KEY: "test-key" };
type Dependencies = NonNullable<Parameters<typeof evaluateReplyIntelligence>[1]>;
function response(intent = "meeting_request") {
  return {
    model: TYPESAFE_MODEL, usage: { input_tokens: 3000, output_tokens: 500 },
    answers: {
      primaryIntent: { type: "choice", choice: intent, confidence: 1,
        probabilities: Object.fromEntries(REPLY_INTENTS.map(label => [label, label === intent ? 1 : 0])) },
      meetingRequested: { type: "noul", noul: 0.98 }, pricingRequested: { type: "noul", noul: 0.95 },
      stopContactRequested: { type: "noul", noul: 0 }, referralPresent: { type: "noul", noul: 0 },
      automatedReply: { type: "noul", noul: 0 },
      buyingIntent: { type: "score", score: 2, confidence: 1, probabilities: { "0": 0, "1": 0, "2": 1, "3": 0 } },
    },
  };
}
function harness(overrides: Partial<Dependencies> = {}) {
  const logs: Parameters<Dependencies["persist"]>[0][] = [];
  const warnings: string[] = [];
  let evaluations = 0;
  const deps: Dependencies = {
    resolveTeam: async () => teamId,
    cached: async (tenant, description) => {
      const log = logs.find(row => row.tenant_id === tenant && row.description === description && row.service === "reply_decision");
      return log ? { metadata: log.metadata } : null;
    },
    evaluate: async (_key, _state, observe) => {
      evaluations++; observe({ status: 200, latencyMs: 12, requestId: "provider-id" }); return response();
    },
    persist: async data => { logs.push(data); }, warn: phase => { warnings.push(phase); }, ...overrides,
  };
  return { deps, logs, warnings, get evaluations() { return evaluations; } };
}
test("Jev is primary for every team; obsolete pilot settings do not gate it", async () => {
  for (const tenant of [teamId, otherTeam]) {
    const h = harness({ resolveTeam: async () => tenant });
    assert.equal((await evaluateReplyIntelligence({ ...input, teamId: tenant }, h.deps,
      { ...env, TYPESAFE_REPLY_SHADOW_ENABLED: "false", TYPESAFE_REPLY_SHADOW_TEAM_IDS: "" }))?.sentiment, "POSITIVE");
    assert.equal(h.evaluations, 1); assert.equal(h.logs[0].tenant_id, tenant);
  }
});
test("unverified tenant, user, and source cannot send content to Jev", async () => {
  for (const invalid of [
    { ...input, teamId: null }, { ...input, teamId: "bad" }, { ...input, userId: "system" },
    { ...input, outreachItemId: "bad" }, { ...input, messageId: undefined },
    { ...input, messageId: "x".repeat(257) }, { ...input, reply: " " }, { ...input, teamId: otherTeam },
  ]) {
    const h = harness(); assert.equal(await evaluateReplyIntelligence(invalid, h.deps, env), undefined);
    assert.equal(h.evaluations, 0); assert.equal(h.logs.length, 0);
  }
});
test("missing credentials are visible as unavailable with fallback", async () => {
  const h = harness(); assert.equal(await evaluateReplyIntelligence(input, h.deps, {}), undefined);
  assert.equal(h.evaluations, 0); assert.equal(h.logs[0].service, "reply_decision_unavailable");
  const metadata = h.logs[0].metadata as any;
  assert.equal(metadata.errorCode, "not_configured"); assert.equal(metadata.fallbackUsed, true);
  assert.equal(metadata.attemptCount, 0); assert.equal(metadata.costKnown, false);
});
test("success logs probabilities, tokens, provider cost, latency, and attempts without content or credentials", async () => {
  const h = harness(); const result = await evaluateReplyIntelligence(input, h.deps, env);
  assert.equal(result?.decision.signals.pricing, 0.95);
  const log = h.logs[0]; const metadata = log.metadata as any;
  assert.equal(log.service, "reply_decision"); assert.equal(log.user_id, input.userId);
  assert.equal(log.tokens_in, 3000); assert.equal(log.tokens_out, 500);
  assert(Math.abs(Number(log.cost) - 0.000126) < 1e-12);
  assert.equal(metadata.mode, "primary"); assert.equal(metadata.billable, false);
  assert.equal(metadata.status, "succeeded"); assert.equal(metadata.costKnown, true);
  assert.equal(metadata.response.answers.pricingRequested.noul, 0.95);
  assert.equal(metadata.attempts[0].requestId, "provider-id");
  assert.match(metadata.stateHash, /^[a-f\d]{64}$/);
  for (const sensitive of [input.reply, input.context.leadName, input.context.originalSubject, env.TYPESAFE_API_KEY])
    assert(!JSON.stringify(log).includes(sensitive));
});
test("request state is bounded and truncation is visible", async () => {
  const h = harness({ evaluate: async (_key, state) => {
    assert.equal(state.reply.length, 2000); assert.equal(state.originalSubject.length, 200);
    assert.equal(state.leadName.length, 150); assert.equal(state.leadCompany.length, 150); return response();
  } });
  await evaluateReplyIntelligence({ ...input, reply: "x".repeat(2500), context: {
    originalSubject: "s".repeat(300), leadName: "n".repeat(300), leadCompany: "c".repeat(300),
  } }, h.deps, env);
  assert.equal((h.logs[0].metadata as any).inputTruncated, true);
});
test("stop-contact, automation, and uncertainty override positive workflow actions", () => {
  const mixed = response(); mixed.answers.stopContactRequested.noul = 0.9;
  const stop = deriveReplyDecision(ReplyDecisionResponseSchema.parse(mixed));
  assert.equal(stop.sentiment, "NEGATIVE"); assert.equal(stop.decision.stopContact, true);
  assert.equal(stop.suggestedAction, "TAG_FOR_REVIEW");
  assert.equal(deriveReplyDecision(ReplyDecisionResponseSchema.parse(response("opt_out"))).decision.stopContact, true);
  assert.equal(deriveReplyDecision(ReplyDecisionResponseSchema.parse(response("out_of_office"))).decision.automated, true);
  const automated = response(); automated.answers.automatedReply.noul = 0.95;
  assert.equal(deriveReplyDecision(ReplyDecisionResponseSchema.parse(automated)).sentiment, "NEUTRAL");
  const uncertain = response(); uncertain.answers.primaryIntent.confidence = 0.4;
  assert.equal(deriveReplyDecision(ReplyDecisionResponseSchema.parse(uncertain)).decision.requiresReview, true);
  assert.equal(deriveReplyDecision(ReplyDecisionResponseSchema.parse(uncertain)).sentiment, "NEUTRAL");
});
test("invalid distributions, labels, scores, usage, or model versions fall back visibly", async () => {
  const invalid: unknown[] = [response("invented_action"), {}];
  const probability = response(); probability.answers.stopContactRequested.noul = 1.1; invalid.push(probability);
  const distribution = response(); distribution.answers.primaryIntent.probabilities.meeting_request = 0.2; invalid.push(distribution);
  const winner = response(); winner.answers.primaryIntent.choice = "interested"; invalid.push(winner);
  const score = response(); score.answers.buyingIntent.score = 1; invalid.push(score);
  const usage = response(); usage.usage.input_tokens = -1; invalid.push(usage);
  const model = response(); model.model = "unknown-model"; invalid.push(model);
  for (const value of invalid) {
    const h = harness({ evaluate: async () => value });
    assert.equal(await evaluateReplyIntelligence(input, h.deps, env), undefined);
    assert.equal(h.logs[0].service, "reply_decision_error");
    assert.equal((h.logs[0].metadata as any).errorCode, "invalid_response");
    assert.equal((h.logs[0].metadata as any).fallbackUsed, true);
  }
});
test("provider failures report sanitized status and attempts without echoing error bodies", async () => {
  const h = harness({ evaluate: async (_key, _state, observe) => {
    observe({ status: 429, latencyMs: 20, requestId: null });
    throw Object.assign(new Error("sensitive reply / credential"), { status: 429 });
  } });
  assert.equal(await evaluateReplyIntelligence(input, h.deps, env), undefined);
  const metadata = h.logs[0].metadata as any;
  assert.equal(metadata.errorCode, "rate_limit"); assert.equal(metadata.httpStatus, 429);
  assert.equal(metadata.attemptCount, 1); assert.equal(metadata.usageKnown, false);
  assert(!JSON.stringify(h.logs).includes("sensitive"));
});
test("concurrent callbacks share evaluation; persisted replay has no provider cost", async () => {
  const h = harness();
  const [first, concurrent] = await Promise.all([
    evaluateReplyIntelligence(input, h.deps, env), evaluateReplyIntelligence(input, h.deps, env),
  ]);
  assert.deepEqual(first, concurrent); assert.equal(h.evaluations, 1); assert.equal(h.logs.length, 1);
  assert.deepEqual(await evaluateReplyIntelligence(input, h.deps, env), first);
  assert.equal(h.evaluations, 1); assert.equal(h.logs[1].service, "reply_decision_cache");
  assert.equal(h.logs[1].tokens_in, 0); assert.equal(h.logs[1].cost, 0);
});
test("changed evidence has a distinct cache identity and failed evaluations can retry", async () => {
  const h = harness(); await evaluateReplyIntelligence(input, h.deps, env);
  await evaluateReplyIntelligence({ ...input, reply: "Please schedule a demo tomorrow." }, h.deps, env);
  assert.equal(h.evaluations, 2); assert.notEqual(h.logs[0].description, h.logs[1].description);
  const failed = harness({ evaluate: async () => { throw new Error("unavailable"); } });
  await evaluateReplyIntelligence(input, failed.deps, env);
  assert.equal((await evaluateReplyIntelligence(input, harness().deps, env))?.sentiment, "POSITIVE");
});
test("telemetry outages do not discard a valid primary decision", async () => {
  const h = harness({ cached: async () => { throw new Error("database unavailable"); },
    persist: async () => { throw new Error("database unavailable"); } });
  assert.equal((await evaluateReplyIntelligence(input, h.deps, env))?.sentiment, "POSITIVE");
  assert.deepEqual(h.warnings, ["telemetry", "telemetry"]);
});
test("SDK sends a pinned batch and observes every retry without logging bodies", async () => {
  const attempts: TypeSafeAttempt[] = []; let calls = 0;
  const client = createTypeSafeClient("test-key", async (url, init) => {
    calls++; assert.equal(url, "https://api.typesafe.ai/v1/systemone");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-key");
    assert(init?.signal instanceof AbortSignal);
    const body = JSON.parse(init?.body as string);
    assert.equal(body.model, TYPESAFE_MODEL); assert.equal(Object.keys(body.questions).length, 7);
    return calls === 1 ? Response.json({}, { status: 429 }) : Response.json(response(), { headers: { "x-request-id": "request-2" } });
  }, attempt => attempts.push(attempt));
  const result = await evaluateTypeSafe(client, buildReplyDecisionState(input.reply, input.context), REPLY_QUESTIONS);
  assert(ReplyDecisionResponseSchema.safeParse(result).success); assert.equal(client.logLevel, "off");
  assert.deepEqual(attempts.map(attempt => attempt.status), [429, 200]); assert.equal(attempts[1].requestId, "request-2");
});
test("authorization failures do not retry; stalled requests stay within budget", async () => {
  let calls = 0;
  const unauthorized = createTypeSafeClient("test-key", async () => { calls++; return Response.json({}, { status: 401 }); });
  await assert.rejects(evaluateTypeSafe(unauthorized, { reply: input.reply }, REPLY_QUESTIONS)); assert.equal(calls, 1);
  const stalled = createTypeSafeClient("test-key", async (_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  }));
  const started = Date.now(); await assert.rejects(evaluateTypeSafe(stalled, { reply: input.reply }, REPLY_QUESTIONS));
  assert(Date.now() - started < 4000);
});
function loadModule(file: string, modules: Record<string, unknown>) {
  const source = readFileSync(path.resolve(file), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports: Record<string, any> = {};
  vm.runInNewContext(compiled.outputText, { exports, require: (id: string) => {
    assert(id in modules, `Unexpected dependency: ${id}`); return modules[id];
  } }); return exports;
}
function analyzerHarness(primary: ReturnType<typeof deriveReplyDecision> | undefined, failGeneration = false) {
  let generations = 0;
  const baseline = { sentiment: "NEGATIVE", reasoning: "Legacy result", suggestedAction: "TAG_FOR_REVIEW", extractedContact: { firstName: "Dana" } };
  const analyzer = loadModule("actions/crm/analyze-sentiment.ts", {
    "@/lib/varuni": { getAiSdkModel: async () => ({ model: {}, modelId: "existing-model", teamId }), logAiUsage: async () => {} },
    ai: { generateObject: async () => { generations++; if (failGeneration) throw new Error("generation failed"); return { object: baseline, usage: {} }; } },
    zod: { z }, "@/lib/logger": { systemLogger: { info() {}, warn() {}, error() {} } },
    "@/lib/ai/reply-intelligence": { evaluateReplyIntelligence: async () => primary },
  }); return { analyze: analyzer.analyzeReplySentiment, baseline, get generations() { return generations; } };
}
test("Jev replaces the classifier without duplicate generation", async () => {
  const primary = deriveReplyDecision(ReplyDecisionResponseSchema.parse(response())); const h = analyzerHarness(primary);
  assert.deepEqual(await h.analyze(input.reply, input.context, input.userId, input), primary); assert.equal(h.generations, 0);
});
test("account extraction is retained while Jev owns classification, including generation failure", async () => {
  const primary = deriveReplyDecision(ReplyDecisionResponseSchema.parse(response())); const h = analyzerHarness(primary);
  const result = await h.analyze(input.reply, { ...input.context, extractContact: true }, input.userId, input);
  assert.equal(result.sentiment, "POSITIVE");
  assert.deepEqual(JSON.parse(JSON.stringify(result.extractedContact)), h.baseline.extractedContact); assert.equal(h.generations, 1);
  const failed = analyzerHarness(primary, true);
  assert.deepEqual(await failed.analyze(input.reply, { extractContact: true }, input.userId, input), primary);
});
test("unavailability preserves legacy classification and final neutral fallback", async () => {
  const h = analyzerHarness(undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(await h.analyze(input.reply, input.context, input.userId, input))), h.baseline);
  assert.equal((await analyzerHarness(undefined, true).analyze(input.reply, {}, input.userId, input)).sentiment, "NEUTRAL");
});
test("included decisions and failures consume no request credits and inflate no invoices", async () => {
  const records = [{ tenant_id: teamId, service: "sentiment_analysis", tokens_in: 100, tokens_out: 20, cost: 0.01 },
    ...DECISION_SERVICES.map(service => ({ tenant_id: teamId, service, tokens_in: 3000, tokens_out: 500, cost: 0.000126 }))];
  const find = ({ where }: any) => {
    assert.equal(where.tenant_id, teamId); assert.deepEqual(Array.from(where.service.notIn), [...DECISION_SERVICES]);
    return records.filter(row => row.tenant_id === where.tenant_id && !where.service.notIn.includes(row.service));
  };
  const common = {
    "@/lib/prisma": { prismadb: {
      team: { findUnique: async () => ({ assigned_plan: { slug: "FREE", max_credits: 2 } }) },
      crm_AiUsageLog: { count: async (query: any) => find(query).length, findMany: async (query: any) => find(query) },
    } }, "@/lib/logger": { systemLogger: { error: () => assert.fail("Accounting failed") } },
    "@/lib/ai/reply-decisions": { DECISION_SERVICES },
  };
  const quota = loadModule("lib/quota-service.ts", { ...common,
    "@/lib/ai-tokens": { getTeamAiTokenBalance: () => assert.fail("Unexpected token deduction") },
    "@/config/subscriptions": { SUBSCRIPTION_PLANS: {}, resolveSlug: () => "FREE" },
  });
  assert.equal((await quota.checkTeamQuota(teamId, "CREDITS")).allowed, true);
  records.push({ ...records[0] }); assert.equal((await quota.checkTeamQuota(teamId, "CREDITS")).allowed, false); records.pop();
  const billing = loadModule("actions/billing/get-ai-usage.ts", { ...common,
    "next-auth": { getServerSession: async () => ({ user: { id: input.userId } }) }, "@/lib/auth": { authOptions: {} },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await billing.getTeamAiUsage(teamId))), [records[0]]);
  assert.equal((await billing.getTeamAiUsageSummary(teamId))[0].total_cost, 0.01);
});
function reportHarness(user: { team_id: string | null; team_role: string | null } | null) {
  const queries: any[] = [];
  const store = {
    crm_AiUsageLog: {
      groupBy: async (query: any) => { queries.push(query); return [{ service: "reply_decision", _count: { _all: 120 }, _sum: { tokens_in: 12000, tokens_out: 6000, cost: 0.000504 } }]; },
      findMany: async (query: any) => { queries.push(query); return Array.from({ length: 51 }, (_, i) => ({ id: i.toString(16).padStart(24, "0") })); },
    }, team: { findMany: async (query: any) => { queries.push(query); return []; } },
  }; return { queries, deps: { currentUser: async () => user, store: async () => store as any } };
}
test("members get tenant-scoped totals for the full period independently of pagination", async () => {
  const h = reportHarness({ team_id: teamId, team_role: "MEMBER" });
  const report = await getDecisionReport({ scope: "team", days: "all", cursor: "ffffffffffffffffffffffff" }, h.deps);
  assert.equal(report.totals.decisions, 120); assert.equal(report.recent.length, 50);
  assert.equal(report.nextCursor, "000000000000000000000031"); assert.equal(h.queries.length, 2);
  for (const query of h.queries) assert.equal(query.where.tenant_id, teamId);
  assert.equal(h.queries[0].where.createdAt, undefined); assert.deepEqual(h.queries[1].where.id, { lt: "ffffffffffffffffffffffff" });
});
test("unauthenticated, cross-tenant, and ordinary team admin global reports are denied before reading usage", async () => {
  for (const [user, options] of [
    [null, { scope: "team" }], [{ team_id: teamId, team_role: "ADMIN" }, { scope: "platform" }],
    [{ team_id: teamId, team_role: "OWNER" }, { scope: "platform" }],
    [{ team_id: teamId, team_role: "MEMBER" }, { scope: "team", teamId: otherTeam }],
  ] as const) {
    const h = reportHarness(user); await assert.rejects(getDecisionReport(options, h.deps), DecisionAccessError);
    assert.equal(h.queries.length, 0);
  }
});
test("platform admins inspect all teams or one team with date and cursor validation", async () => {
  const h = reportHarness({ team_id: teamId, team_role: "PLATFORM_ADMIN" });
  const all = await getDecisionReport({ scope: "platform", days: "invalid", cursor: "invalid" }, h.deps);
  assert.equal(all.days, "30"); assert.equal(h.queries[0].where.tenant_id, undefined);
  assert(h.queries[0].where.createdAt.gte instanceof Date); assert.equal(h.queries[1].where.id, undefined);
  assert.equal(h.queries.length, 3);
  const scoped = reportHarness({ team_id: teamId, team_role: "PLATFORM_ADMIN" });
  await getDecisionReport({ scope: "platform", teamId: otherTeam, days: "7" }, scoped.deps);
  assert.equal(scoped.queries[0].where.tenant_id, otherTeam);
});
