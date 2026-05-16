import "server-only";

import { db } from "@/lib/db/client";
import { llmCalls } from "@/lib/db/schema";
import { gte, sql } from "drizzle-orm";

/**
 * Global daily LLM cost cap. Before any new swarm cycle launches we sum
 * today's prompt + completion tokens from llm_calls (across all users
 * and all tiers), multiply by a flat blended `$/1K tokens` rate, and
 * abort if we are over the daily USD budget.
 *
 * Both env vars are required for the cap to fire. If either is missing
 * we log a warning and return false (no cap) so a misconfigured deploy
 * does not silently block the swarm.
 *
 * Returns `{ exhausted: boolean, spendUsd: number, capUsd: number | null }`.
 */
export type CostCapResult = {
  exhausted: boolean;
  spendUsd: number;
  capUsd: number | null;
};

const UTC_DAY_START_SQL = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;

export async function checkLlmBudget(): Promise<CostCapResult> {
  const capStr = process.env.MAX_DAILY_LLM_USD;
  const rateStr = process.env.LLM_COST_PER_1K_TOKENS_USD;
  const cap = capStr ? Number(capStr) : null;
  const ratePer1k = rateStr ? Number(rateStr) : null;

  if (!cap || !ratePer1k || !Number.isFinite(cap) || !Number.isFinite(ratePer1k)) {
    if (capStr || rateStr) {
      console.warn(
        "[cost-cap] MAX_DAILY_LLM_USD and LLM_COST_PER_1K_TOKENS_USD must both be set numeric; cap not enforced",
      );
    }
    return { exhausted: false, spendUsd: 0, capUsd: cap };
  }

  const [row] = await db
    .select({
      tokens: sql<string>`COALESCE(SUM(${llmCalls.promptTokens} + ${llmCalls.completionTokens}), 0)::text`,
    })
    .from(llmCalls)
    .where(gte(llmCalls.createdAt, UTC_DAY_START_SQL as unknown as Date));

  const tokens = Number(row?.tokens ?? "0");
  const spendUsd = (tokens / 1000) * ratePer1k;
  return { exhausted: spendUsd >= cap, spendUsd, capUsd: cap };
}

export async function isLlmBudgetExhausted(): Promise<boolean> {
  return (await checkLlmBudget()).exhausted;
}
