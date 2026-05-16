import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";

export { summarizeBacktestTrades, type BacktestSummary } from "./summarize-trades";

const ENTRY_CONF = 0.6;
const HOLD_DAYS = 3;
const SIZE_USD = 150;

type BiasEntry = { asset: string; bias: string; confidence: number };

function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function closeAt(candles: Candle[], dayMs: number): number | null {
  const c = candles.find((cd) => cd.t === dayMs);
  if (!c) return null;
  const n = Number(c.c);
  return Number.isFinite(n) ? n : null;
}

/**
 * Walk every complete daily_plan for the run, open a simulated trade
 * for each asset whose bias is long/short with confidence >= 0.6,
 * close after HOLD_DAYS or at end-of-run. Fixed $150 size per trade
 * (15% of $1000 simulated starting equity). No leverage. Idempotent:
 * deletes existing backtest_trades for the run before re-simulating.
 */
export async function simulateTradesForBacktest(runId: string): Promise<{
  opened: number; closed: number; skipped: number;
}> {
  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, runId)).limit(1);
  if (!run) throw new Error(`backtest_run ${runId} not found`);

  await db.delete(backtestTrades).where(eq(backtestTrades.backtestRunId, runId));

  const plans = await db.select().from(dailyPlans)
    .where(eq(dailyPlans.backtestRunId, runId))
    .orderBy(asc(dailyPlans.generatedAt));

  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${run.endDate}T00:00:00Z`) + (HOLD_DAYS + 1) * 86_400_000;
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
    const targetExit = entryDayMs + HOLD_DAYS * 86_400_000;
    const exitDayMs = targetExit > runEndMs ? runEndMs : targetExit;

    for (const b of json.biasByAsset) {
      const side = b.bias;
      if (side !== "long" && side !== "short") continue;
      if (b.confidence < ENTRY_CONF) continue;
      const asset = b.asset.toUpperCase();
      const candles = candleCache.get(asset);
      if (!candles) continue;
      const entryPrice = closeAt(candles, entryDayMs);
      const exitPrice = closeAt(candles, exitDayMs);
      if (entryPrice === null || exitPrice === null) { skipped++; continue; }

      const move = side === "long" ? (exitPrice - entryPrice) / entryPrice : (entryPrice - exitPrice) / entryPrice;
      const pnlUsd = SIZE_USD * move;
      const pnlPct = move * 100;
      opened++; closed++;
      await db.insert(backtestTrades).values({
        backtestRunId: runId, asset, side,
        entryDate: new Date(entryDayMs), entryPrice: entryPrice.toString(),
        exitDate: new Date(exitDayMs), exitPrice: exitPrice.toString(),
        sizeUsd: SIZE_USD.toString(),
        pnlUsd: pnlUsd.toString(), pnlPct: pnlPct.toString(),
        biasConfidence: b.confidence.toString(),
        status: "closed",
        exitReason: targetExit > runEndMs ? "end_of_backtest" : "time_exit",
      });
    }
  }

  return { opened, closed, skipped };
}
