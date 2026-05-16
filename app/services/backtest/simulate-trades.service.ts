import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";
import { closeAt, type OpenPos, STARTING_EQUITY_USD, utcDayMs, writeBacktestClose } from "./simulate-helpers";

export { summarizeBacktestTrades, type BacktestSummary } from "./summarize-trades";

type BiasEntry = { asset: string; bias: string; confidence: number };
type PlanJson = {
  biasByAsset?: BiasEntry[];
  riskCaps?: { maxLeverage?: number; maxNotionalPctOfEquity?: number };
};

/**
 * Replay agent decisions. Direction from bias; size from
 * riskCaps.maxNotionalPctOfEquity * current equity; leverage from
 * riskCaps.maxLeverage; exit when bias reverses or goes neutral.
 * Equity compounds. No hardcoded thresholds.
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
  const allAssets = Array.from(new Set(plans.flatMap((p) => {
    const j = p.planJson as PlanJson | null;
    return j?.biasByAsset?.map((b) => b.asset.toUpperCase()) ?? [];
  })));
  const candleCache = new Map<string, Candle[]>();
  for (const a of allAssets) candleCache.set(a, await fetchCandles(a, "1d", startMs, endMs));

  let equity = STARTING_EQUITY_USD;
  let opened = 0, closed = 0;
  const positions = new Map<string, OpenPos>();

  for (const plan of plans) {
    if (plan.status !== "complete") continue;
    const json = plan.planJson as PlanJson | null;
    if (!json?.biasByAsset) continue;
    const dayMs = utcDayMs(plan.generatedAt);
    const notionalPct = json.riskCaps?.maxNotionalPctOfEquity ?? 15;
    const leverage = Math.max(1, json.riskCaps?.maxLeverage ?? 1);

    for (const b of json.biasByAsset) {
      const asset = b.asset.toUpperCase();
      const candles = candleCache.get(asset);
      const price = candles ? closeAt(candles, dayMs) : null;
      if (price === null) continue;
      const current = positions.get(asset);
      const wantsLong = b.bias === "long";
      const wantsShort = b.bias === "short";
      const reverse = current && ((current.side === "long" && wantsShort) || (current.side === "short" && wantsLong));
      const neutralized = current && !wantsLong && !wantsShort;

      if (current && (reverse || neutralized)) {
        equity += await writeBacktestClose({
          runId, asset, pos: current,
          exitDate: new Date(dayMs), exitPrice: price,
          reason: neutralized ? "agent_neutral" : "agent_reversed",
        });
        closed++;
        positions.delete(asset);
      }

      if ((wantsLong || wantsShort) && !positions.has(asset)) {
        positions.set(asset, {
          side: wantsLong ? "long" : "short",
          entryDate: new Date(dayMs), entryPrice: price,
          sizeUsd: equity * notionalPct / 100,
          leverage, confidence: b.confidence,
        });
        opened++;
      }
    }
  }

  const lastDayMs = Date.parse(`${run.endDate}T00:00:00Z`);
  for (const [asset, pos] of positions) {
    const candles = candleCache.get(asset);
    const price = candles ? closeAt(candles, lastDayMs) : null;
    if (price === null) continue;
    equity += await writeBacktestClose({
      runId, asset, pos, exitDate: new Date(lastDayMs), exitPrice: price, reason: "end_of_backtest",
    });
    closed++;
  }

  return { opened, closed };
}
