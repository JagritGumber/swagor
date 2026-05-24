import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans, rebalanceCycles, selboInstances } from "@/lib/db/schema";
import { type Candle } from "@/lib/data-sources/hyperliquid";
import { fetchCandlesPaginated } from "@/lib/data-sources/hyperliquid-candles";
import { closeAllAtEnd, type CloseSink, STARTING_EQUITY_USD, writeBacktestClose } from "./simulate-helpers";
import { stepWatcherTick, type ReplayCtx } from "./watcher-tick-step";
import { createInMemoryStore } from "@/app/services/setup-fingerprint/in-memory";

export { summarizeBacktestTrades, type BacktestSummary } from "./summarize-trades";

const HOUR_MS = 3_600_000;

function utcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Replay watcher decisions across the run window. Trades come from the
 * same evaluateSelboTick object live uses; swarm cycles only gate WHICH
 * days may trade (a day needs a completed cycle + plan). Trade content
 * itself is deterministic and independent of the LLM plan.
 */
export async function simulateTradesForBacktest(runId: string): Promise<{ opened: number; closed: number }> {
  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, runId)).limit(1);
  if (!run) throw new Error(`backtest_run ${runId} not found`);
  await db.delete(backtestTrades).where(eq(backtestTrades.backtestRunId, runId));

  const plans = await db.select().from(dailyPlans).where(eq(dailyPlans.backtestRunId, runId)).orderBy(asc(dailyPlans.generatedAt));
  const cycles = await db.select().from(rebalanceCycles).where(eq(rebalanceCycles.backtestRunId, runId)).orderBy(asc(rebalanceCycles.asOf));
  const planDays = new Set(plans.map((p) => utcDay(p.generatedAt)));
  const cycleDays = new Set(cycles.map((c) => (c.asOf ? utcDay(c.asOf) : 0)));

  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${run.endDate}T00:00:00Z`) + 2 * 86_400_000;
  // Asset universe is the instance watch set, NOT the LLM watchlist:
  // the latter varies between runs. Deterministic universe -> deterministic trades.
  const [instance] = await db.select({ currentlyWatching: selboInstances.currentlyWatching, strategyText: selboInstances.strategyText })
    .from(selboInstances).where(eq(selboInstances.id, run.selboInstanceId)).limit(1);
  const allAssets = (instance?.currentlyWatching ?? ["BTC", "ETH", "SOL"]).map((a) => a.toUpperCase());
  const candleCache = new Map<string, Candle[]>();
  // Paginated: a single fetchCandles caps at ~5000 candles (~7 months of
  // 1h), silently truncating longer windows. Paginate so the full window
  // is covered.
  for (const a of allAssets) candleCache.set(a, await fetchCandlesPaginated(a, "1h", startMs - 7 * 86_400_000, endMs));

  const writeClose: CloseSink = (a) => writeBacktestClose({ runId, ...a });
  const ctx: ReplayCtx = {
    runId, assets: allAssets, candleCache, positions: new Map(), equity: STARTING_EQUITY_USD,
    opened: 0, closed: 0, currentDayMs: Number.NaN, dailyTradeCount: 0, dailyLossCount: 0,
    dailyRealizedPnlUsd: 0, cooldownUntil: {}, writeClose,
    strategyText: instance?.strategyText ?? "",
    fpStore: createInMemoryStore(),
  };
  const lastTick = Date.parse(`${run.endDate}T23:00:00Z`);
  for (let tickMs = startMs; tickMs <= lastTick; tickMs += HOUR_MS) {
    const dayMs = utcDay(new Date(tickMs));
    await stepWatcherTick(ctx, tickMs, cycleDays.has(dayMs) && planDays.has(dayMs));
  }

  const end = await closeAllAtEnd({ writeClose, positions: ctx.positions, candleCache, lastDayMs: lastTick });
  return { opened: ctx.opened, closed: ctx.closed + end.closed };
}
