import "server-only";

import { db } from "@/lib/db/client";
import { llmCalls } from "@/lib/db/schema";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";

/**
 * Per-user daily LLM cost cap. Sums today's `cost_usd` from llm_calls
 * (already populated at log time from per-model rates in lib/llm/rates.ts)
 * scoped to a single selbo_instance_id and aborts the new swarm cycle
 * when spend >= PER_USER_DAILY_LLM_USD.
 *
 * One env var, one query, real per-row costs, per-tenant isolation.
 * Replaces the old global MAX_DAILY_LLM_USD * blended-rate guess.
 *
 * Returns { exhausted, spendUsd, capUsd: null } when no cap is set so
 * a misconfigured deploy never silently blocks the swarm.
 */
export type CostCapResult = {
  exhausted: boolean;
  spendUsd: number;
  capUsd: number | null;
};

const UTC_DAY_START_SQL = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;

export async function checkLlmBudget(selboInstanceId: string): Promise<CostCapResult> {
  const capStr = process.env.PER_USER_DAILY_LLM_USD;
  const cap = capStr ? Number(capStr) : null;
  if (!cap || !Number.isFinite(cap)) {
    if (capStr) {
      console.warn("[cost-cap] PER_USER_DAILY_LLM_USD must be numeric; cap not enforced");
    }
    return { exhausted: false, spendUsd: 0, capUsd: null };
  }

  const [row] = await db
    .select({ totalUsd: sql<string>`COALESCE(SUM(${llmCalls.costUsd}), 0)::text` })
    .from(llmCalls)
    .where(and(
      eq(llmCalls.selboInstanceId, selboInstanceId),
      isNotNull(llmCalls.costUsd),
      gte(llmCalls.createdAt, UTC_DAY_START_SQL as unknown as Date),
    ));
  const spendUsd = Number(row?.totalUsd ?? "0");
  return { exhausted: spendUsd >= cap, spendUsd, capUsd: cap };
}

export async function isLlmBudgetExhausted(selboInstanceId: string): Promise<boolean> {
  return (await checkLlmBudget(selboInstanceId)).exhausted;
}
