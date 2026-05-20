import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, type SelboInstance } from "@/lib/db/schema";
import { fetchCandlesPaginated } from "@/lib/data-sources/hyperliquid-candles";
import type { Candle } from "@/lib/data-sources/hyperliquid";
import { closeAllAtEnd, STARTING_EQUITY_USD } from "./simulate-helpers";
import { stepWatcherTick, type ReplayCtx } from "./watcher-tick-step";

const HOUR_MS = 3_600_000;

/**
 * Continuous watcher-only replay over a long historical window. No
 * swarm and no LLM: trades come purely from the deterministic watcher
 * on historical candles, so the run is reproducible and cheap. Creates
 * a backtest_runs row (plannerPromptVersion="watcher_replay_v1") and
 * writes trades to it. Backs the 1-year flagship track record.
 */
export async function runWatcherReplay(params: {
  instance: SelboInstance; startDate: string; endDate: string; assets?: string[];
}): Promise<{ runId: string; opened: number; closed: number }> {
  const assets = (params.assets ?? params.instance.currentlyWatching ?? ["BTC", "ETH", "SOL"]).map((a) => a.toUpperCase());
  const startMs = Date.parse(`${params.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${params.endDate}T23:00:00Z`);
  const days = Math.round((endMs - startMs) / 86_400_000) + 1;

  const [run] = await db.insert(backtestRuns).values({
    userId: params.instance.userId, selboInstanceId: params.instance.id,
    startDate: params.startDate, endDate: params.endDate, days,
    status: "running", cyclesRequested: 0, plannerPromptVersion: "watcher_replay_v1",
  }).returning();
  if (!run) throw new Error("backtest_runs insert returned no row");

  try {
    const candleCache = new Map<string, Candle[]>();
    for (const a of assets) {
      candleCache.set(a, await fetchCandlesPaginated(a, "1h", startMs - 7 * 86_400_000, endMs + 86_400_000));
    }
    const ctx: ReplayCtx = {
      runId: run.id, assets, candleCache, positions: new Map(), equity: STARTING_EQUITY_USD,
      opened: 0, closed: 0, currentDayMs: Number.NaN, dailyTradeCount: 0, dailyLossCount: 0,
      dailyRealizedPnlUsd: 0, cooldownUntil: {},
    };
    for (let tickMs = startMs; tickMs <= endMs; tickMs += HOUR_MS) {
      await stepWatcherTick(ctx, tickMs, true);
    }
    const end = await closeAllAtEnd({ runId: run.id, positions: ctx.positions, candleCache, lastDayMs: endMs });
    await db.update(backtestRuns).set({ status: "completed", cyclesCompleted: days, completedAt: new Date() }).where(eq(backtestRuns.id, run.id));
    return { runId: run.id, opened: ctx.opened, closed: ctx.closed + end.closed };
  } catch (err) {
    await db.update(backtestRuns).set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err), completedAt: new Date() }).where(eq(backtestRuns.id, run.id));
    throw err;
  }
}
