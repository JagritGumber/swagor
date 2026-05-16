import "server-only";

import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dailyPlans, rebalanceCycles } from "@/lib/db/schema";

const RATE_LIMIT_MAX_CYCLES_24H = 3;
const RATE_LIMIT_MIN_COOLDOWN_HOURS = 4;
const UTC_DAY_START = sql`date_trunc('day', now() AT TIME ZONE 'UTC')`;

/**
 * Watcher-trigger rate limit: max 3 cycles per UTC day per instance,
 * and a 4h cooldown between cycles. Daily-scheduled triggers do not
 * use this; they are gated by the idempotency check instead.
 */
export async function rateLimitBlocked(instanceId: string): Promise<string | null> {
  const rows = await db.select({ startedAt: rebalanceCycles.startedAt })
    .from(rebalanceCycles)
    .where(and(eq(rebalanceCycles.selboInstanceId, instanceId),
      gte(rebalanceCycles.startedAt, sql`now() - interval '24 hours'` as unknown as Date)));
  if (rows.length >= RATE_LIMIT_MAX_CYCLES_24H) return "rate_limit_24h_cap";
  const latest = rows.reduce<Date | null>(
    (acc, r) => acc && acc > r.startedAt ? acc : r.startedAt, null,
  );
  if (latest && Date.now() - latest.getTime() < RATE_LIMIT_MIN_COOLDOWN_HOURS * 3_600_000) {
    return "rate_limit_cooldown";
  }
  return null;
}

/**
 * Idempotency: only `complete` daily_plans rows count as "already
 * ran today". A failed row from an earlier attempt MUST allow the
 * 00:30 UTC retry path to regenerate.
 */
export async function existingDailyPlan(instanceId: string): Promise<string | null> {
  // Backtest plans share the table but must NEVER satisfy the live
  // idempotency check; filter them out via isNull(backtestRunId).
  const [row] = await db.select({ cycleId: dailyPlans.cycleId }).from(dailyPlans)
    .where(and(eq(dailyPlans.selboInstanceId, instanceId),
      eq(dailyPlans.status, "complete"),
      isNull(dailyPlans.backtestRunId),
      gte(dailyPlans.generatedAt, UTC_DAY_START as unknown as Date)));
  return row?.cycleId ?? null;
}

/**
 * Critical-ingestion abort: don't run the swarm if Hyperliquid is
 * dead (no marketFeatures) OR if all soft-context sources (news,
 * lessons, yesterday-plan) are empty/failed. Force-run bypasses.
 */
export function checkIngestionAbort(
  ingestion: Array<{ name: string; status: "ok" | "empty" | "failed" }>,
  symbolCount: number,
): string | null {
  if (symbolCount === 0) return "no_market_features";
  const byName = new Map(ingestion.map((s) => [s.name, s.status]));
  const newsBad = (byName.get("news:gdelt") ?? "ok") !== "ok";
  const lessonsBad = (byName.get("db:lessons") ?? "ok") !== "ok";
  const yesterdayBad = (byName.get("db:yesterday-plan") ?? "ok") !== "ok";
  if (newsBad && lessonsBad && yesterdayBad) return "all_context_sources_empty";
  return null;
}
