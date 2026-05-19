import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";
import { closeAllAtEnd, type OpenPos, STARTING_EQUITY_USD, writeBacktestClose } from "./simulate-helpers";
import { simulateOneBacktestDay } from "./simulate-day-step";

export { summarizeBacktestTrades, type BacktestSummary } from "./summarize-trades";

type BiasEntry = { asset: string };
type PlanJson = { biasByAsset?: BiasEntry[] };

/**
 * Replay agent decisions across the run window. Per-day logic lives in
 * simulateOneBacktestDay (shared with the thesis-memory replay). This
 * service owns DB persistence: deletes prior backtest_trades for the
 * run, then for each plan calls the shared step and writes the
 * resulting closes via writeBacktestClose.
 */
export async function simulateTradesForBacktest(runId: string): Promise<{ opened: number; closed: number }> {
  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, runId)).limit(1);
  if (!run) throw new Error(`backtest_run ${runId} not found`);

  await db.delete(backtestTrades).where(eq(backtestTrades.backtestRunId, runId));

  const plans = await db.select().from(dailyPlans)
    .where(eq(dailyPlans.backtestRunId, runId))
    .orderBy(asc(dailyPlans.generatedAt));

  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${run.endDate}T00:00:00Z`) + 2 * 86_400_000;
  const allAssets = Array.from(new Set(plans.flatMap((p) => (p.planJson as PlanJson | null)?.biasByAsset?.map((b) => b.asset.toUpperCase()) ?? [])));
  const candleCache = new Map<string, Candle[]>();
  for (const a of allAssets) candleCache.set(a, await fetchCandles(a, "1d", startMs, endMs));

  let equity = STARTING_EQUITY_USD;
  let opened = 0, closed = 0;
  const positions = new Map<string, OpenPos>();

  for (const plan of plans) {
    const result = simulateOneBacktestDay({ plan, positions, candleCache, equity });
    for (const c of result.closes) {
      await writeBacktestClose({ runId, asset: c.asset, pos: c.pos, exitDate: c.exitDate, exitPrice: c.exitPrice, reason: c.reason });
    }
    opened += result.opens.length;
    closed += result.closes.length;
    equity = result.newEquity;
  }

  const end = await closeAllAtEnd({ runId, positions, candleCache, lastDayMs: Date.parse(`${run.endDate}T00:00:00Z`) });
  equity += end.equityDelta; closed += end.closed;
  return { opened, closed };
}
