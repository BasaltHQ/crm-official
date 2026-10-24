import "server-only";

import { TypeSafeClient, type Fetch, type Questions } from "@typesafe-ai/sdk";

// Upgrade only after evaluating the new version against the reply dataset.
export const TYPESAFE_MODEL = "jev-1.13.0";
export const TYPESAFE_INPUT_PRICE_PER_MILLION = 0.042;
export const TYPESAFE_REQUEST_BUDGET_MS = 3000;

export interface TypeSafeAttempt {
  status: number | null;
  latencyMs: number;
  requestId: string | null;
}

export function createTypeSafeClient(apiKey: string, fetch?: Fetch, onAttempt?: (attempt: TypeSafeAttempt) => void) {
  return new TypeSafeClient({
    apiKey,
    baseURL: "https://api.typesafe.ai",
    defaultModel: TYPESAFE_MODEL,
    timeout: 1200,
    retry: {
      maxRetries: 1,
      backoffInitialMs: 100,
      backoffMaxMs: 200,
      maxRetryAfterMs: 200,
    },
    // SDK debug logging includes request and response bodies.
    logLevel: "off",
    fetch: onAttempt ? async (url, init) => {
      const startedAt = Date.now();
      try {
        const response = await (fetch || globalThis.fetch)(url, init);
        onAttempt({ status: response.status, latencyMs: Date.now() - startedAt,
          requestId: response.headers.get("x-request-id")?.slice(0, 128) || null });
        return response;
      } catch (error) {
        onAttempt({ status: null, latencyMs: Date.now() - startedAt, requestId: null });
        throw error;
      }
    } : fetch,
  });
}

export function evaluateTypeSafe<Q extends Questions>(
  client: TypeSafeClient,
  state: Record<string, string>,
  questions: Q,
) {
  return client.systemOne(
    { state, questions, model: TYPESAFE_MODEL },
    { signal: AbortSignal.timeout(TYPESAFE_REQUEST_BUDGET_MS) },
  );
}
