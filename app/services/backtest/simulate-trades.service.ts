import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";
import { closeAt, normalizeSimulateOpts, type SimulateOpts, utcDayMs } from "./simulate-helpers";

export { summarizeBacktestTrades, type BacktestSummary } from "./summarize-trades";
export type { SimulateOpts } from "./simulate-helpers";

type BiasEntry = { asset: string; bias: string; confidence: number };

/**
 * Walk every complete daily_plan for the run, open a simulated trade
 * for each asset whose bias is long/short with confidence >= the
 * requested threshold, close after holdDays or at end-of-run. No
 * leverage. Idempotent: deletes existing backtest_trades for the run
 * before re-simulating so the admin can sweep params on the same
 * LLM-generated analyses without re-running the swarm.
 */
export async function simulateTradesForBacktest(
  runId: string, opts?: SimulateOpts,
): Promise<{ opened: number; closed: number; skipped: number; params: Required<SimulateOpts> }> {
  const params = normalizeSimulateOpts(opts);

  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, runId)).limit(1);
  if (!run) throw new Error(`backtest_run ${runId} not found`);

  await db.delete(backtestTrades).where(eq(backtestTrades.backtestRunId, runId));

  const plans = await db.select().from(dailyPlans)
    .where(eq(dailyPlans.backtestRunId, runId))
    .orderBy(asc(dailyPlans.generatedAt));

  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${run.endDate}T00:00:00Z`) + (params.holdDays + 1) * 86_400_000;
  const assets = Array.from(new Set(plans.flatMap((p) => {
    const j = p.planJson as { biasByAsset?: BiasEntry[] } | null;
    return j?.biasByAsset?.map((b) => b.asset.toUpperCase()) ?? [];
  })));
  const candleCache = new Map<string, Candle[]>();
  for (const a of assets) candleCache.set(a, await fetchCandles(a, "1d", startMs, endMs));

  let opened = 0, closed = 0, skipped = 0;
  const runEndMs = Date.parse(`${run.endDate}T00:00:00Z`);

  for (const plan of plans) {
    if (plan.status !== "complete") { skipped++; continue; }
    const json = plan.planJson as { biasByAsset?: BiasEntry[] } | null;
    if (!json?.biasByAsset) continue;
    const entryDayMs = utcDayMs(plan.generatedAt);
    const targetExit = entryDayMs + params.holdDays * 86_400_000;
    const exitDayMs = targetExit > runEndMs ? runEndMs : targetExit;

    for (const b of json.biasByAsset) {
      const side = b.bias;
      if (side !== "long" && side !== "short") continue;
      if (b.confidence < params.entryConfidence) continue;
      const asset = b.asset.toUpperCase();
      const candles = candleCache.get(asset);
      if (!candles) continue;
      const entryPrice = closeAt(candles, entryDayMs);
      const exitPrice = closeAt(candles, exitDayMs);
      if (entryPrice === null || exitPrice === null) { skipped++; continue; }

      const move = side === "long" ? (exitPrice - entryPrice) / entryPrice : (entryPrice - exitPrice) / entryPrice;
      const pnlUsd = params.sizeUsd * move;
      const pnlPct = move * 100;
      opened++; closed++;
      await db.insert(backtestTrades).values({
        backtestRunId: runId, asset, side,
        entryDate: new Date(entryDayMs), entryPrice: entryPrice.toString(),
        exitDate: new Date(exitDayMs), exitPrice: exitPrice.toString(),
        sizeUsd: params.sizeUsd.toString(),
        pnlUsd: pnlUsd.toString(), pnlPct: pnlPct.toString(),
        biasConfidence: b.confidence.toString(),
        status: "closed",
        exitReason: targetExit > runEndMs ? "end_of_backtest" : "time_exit",
      });
    }
  }

  return { opened, closed, skipped, params };
}
