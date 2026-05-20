import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans, rebalanceCycles, selboInstances } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";
import { checkStopTpHit, closeAllAtEnd, type OpenPos, STARTING_EQUITY_USD, writeBacktestClose } from "./simulate-helpers";
import { evaluatePerpRisk } from "@/app/services/risk-engine.service";
import { evaluateSelboTick, type SelboTickInput, type WatcherDecision, type WatcherExecutionState } from "@/app/services/watcher/selbo-tick-engine";
import { deterministicPressureSnapshot } from "./deterministic-pressure";
import { buildSnapshotAt } from "./backtest-snapshot";

export { summarizeBacktestTrades, type BacktestSummary } from "./summarize-trades";

const STOP_COOLDOWN_MS = 6 * 3_600_000;

function openFromDecision(decision: WatcherDecision, price: number, dayMs: number, equity: number): OpenPos | null {
  if (!decision.asset || (decision.action !== "open_long" && decision.action !== "open_short")) return null;
  if (decision.stopLossPriceUsd === null || decision.takeProfitPriceUsd === null) return null;
  const side = decision.action === "open_long" ? "long" : "short";
  return {
    side, entryDate: new Date(dayMs), entryPrice: price,
    sizeUsd: decision.sizeUsd || Math.min(100, equity * 0.1),
    leverage: decision.leverage, confidence: decision.confidence,
    stopPrice: decision.stopLossPriceUsd, tpPrice: decision.takeProfitPriceUsd,
    thesisId: `${decision.asset}:${new Date(dayMs).toISOString()}:watcher`,
    entryReason: decision.reason, invalidatesIf: null,
    setupType: decision.marketTrigger, invalidationSource: null,
    qualityReport: null, watcherDecision: decision as unknown as Record<string, unknown>,
  };
}

function cooldownKey(asset: string, side: "long" | "short"): string {
  return `${asset.toUpperCase()}:${side}`;
}

/**
 * Replay watcher decisions across the run window. Backtest trades must
 * come from the same `evaluateSelboTick` object live uses; swarm plan
 * rows are external context only and never become trades directly.
 */
export async function simulateTradesForBacktest(runId: string): Promise<{ opened: number; closed: number }> {
  const [run] = await db.select().from(backtestRuns).where(eq(backtestRuns.id, runId)).limit(1);
  if (!run) throw new Error(`backtest_run ${runId} not found`);

  await db.delete(backtestTrades).where(eq(backtestTrades.backtestRunId, runId));

  const plans = await db.select().from(dailyPlans)
    .where(eq(dailyPlans.backtestRunId, runId))
    .orderBy(asc(dailyPlans.generatedAt));
  const cycles = await db.select().from(rebalanceCycles)
    .where(eq(rebalanceCycles.backtestRunId, runId))
    .orderBy(asc(rebalanceCycles.asOf));
  const planByDay = new Map(plans.map((p) => [Date.UTC(p.generatedAt.getUTCFullYear(), p.generatedAt.getUTCMonth(), p.generatedAt.getUTCDate()), p]));
  const cycleDays = cycles.map((c) => c.asOf ? Date.UTC(c.asOf.getUTCFullYear(), c.asOf.getUTCMonth(), c.asOf.getUTCDate()) : 0);

  const startMs = Date.parse(`${run.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${run.endDate}T00:00:00Z`) + 2 * 86_400_000;
  // Asset universe is the instance watch set, NOT the LLM-chosen
  // watchlist: the latter varies between runs and silently changes
  // which symbols get evaluated. Deterministic universe -> deterministic trades.
  const [instance] = await db.select({ currentlyWatching: selboInstances.currentlyWatching })
    .from(selboInstances).where(eq(selboInstances.id, run.selboInstanceId)).limit(1);
  const allAssets = (instance?.currentlyWatching ?? ["BTC", "ETH", "SOL"]).map((a) => a.toUpperCase());
  const candleCache = new Map<string, Candle[]>();
  for (const a of allAssets) candleCache.set(a, await fetchCandles(a, "1h", startMs - 7 * 86_400_000, endMs));

  let equity = STARTING_EQUITY_USD;
  let opened = 0, closed = 0;
  let currentDayMs = Number.NaN;
  let dailyTradeCount = 0;
  let dailyLossCount = 0;
  let dailyRealizedPnlUsd = 0;
  const assetSideCooldownUntil: Record<string, string> = {};
  const positions = new Map<string, OpenPos>();

  for (let tickMs = startMs; tickMs <= Date.parse(`${run.endDate}T23:00:00Z`); tickMs += 3_600_000) {
    const dayMs = Date.UTC(new Date(tickMs).getUTCFullYear(), new Date(tickMs).getUTCMonth(), new Date(tickMs).getUTCDate());
    if (dayMs !== currentDayMs) {
      currentDayMs = dayMs;
      dailyTradeCount = 0;
      dailyLossCount = 0;
      dailyRealizedPnlUsd = 0;
    }
    if (!cycleDays.includes(dayMs)) continue;
    const plan = planByDay.get(dayMs);
    if (!plan) continue;
    for (const [asset, pos] of [...positions]) {
      const candle = (candleCache.get(asset) ?? []).find((c) => c.t === tickMs) ?? null;
      const hit = candle ? checkStopTpHit(pos, candle) : null;
      if (!hit) continue;
      const pnlUsd = await writeBacktestClose({ runId, asset, pos, exitDate: new Date(tickMs), exitPrice: hit.price, reason: hit.reason });
      if (hit.reason === "stop_loss") {
        assetSideCooldownUntil[cooldownKey(asset, pos.side)] = new Date(tickMs + STOP_COOLDOWN_MS).toISOString();
      }
      positions.delete(asset); equity += pnlUsd; closed++;
      dailyRealizedPnlUsd += pnlUsd;
      if (pnlUsd < 0) dailyLossCount++;
    }

    const marketFeatures = buildSnapshotAt(allAssets, candleCache, tickMs);
    const risk = evaluatePerpRisk({
      account: { equityUsd: equity, withdrawableUsd: equity },
      positions: [...positions].map(([asset, pos]) => {
        const price = Number((candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c);
        return { source: "paper" as const, asset, side: pos.side, sizeUsd: pos.sizeUsd, entryPrice: pos.entryPrice, markPrice: Number.isFinite(price) ? price : null };
      }),
    });
    const tickInput: SelboTickInput = {
      mode: "backtest",
      asOf: new Date(tickMs).toISOString(),
      strategyText: "",
      externalSentiment: deterministicPressureSnapshot(marketFeatures),
      marketFeatures,
      positions: [...positions].map(([asset, pos]) => ({
        asset, side: pos.side, entryPrice: pos.entryPrice,
        markPrice: Number((candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c),
        sizeUsd: pos.sizeUsd,
        openedAt: pos.entryDate.toISOString(),
      })),
      risk,
      recentLessons: [],
      executionState: {
        dailyTradeCount,
        dailyLossCount,
        dailyRealizedPnlUsd,
        assetSideCooldownUntil,
      } satisfies WatcherExecutionState,
    };
    const decision = evaluateSelboTick(tickInput);
    if ((decision.action === "close" || decision.action === "risk_emergency") && decision.asset) {
      const asset = decision.asset.toUpperCase();
      const pos = positions.get(asset);
      const price = Number((candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c);
      if (pos && Number.isFinite(price)) {
        const reason = decision.blockedReasons.includes("stale_position") ? "time_stop" : decision.action;
        const pnlUsd = await writeBacktestClose({ runId, asset, pos, exitDate: new Date(tickMs), exitPrice: price, reason });
        positions.delete(asset); equity += pnlUsd; closed++;
        dailyRealizedPnlUsd += pnlUsd;
        if (pnlUsd < 0) dailyLossCount++;
      }
    }
    if ((decision.action === "open_long" || decision.action === "open_short") && decision.asset) {
      const asset = decision.asset.toUpperCase();
      const price = Number((candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c);
      const pos = Number.isFinite(price) ? openFromDecision(decision, price, tickMs, equity) : null;
      if (pos) { positions.set(asset, pos); opened++; dailyTradeCount++; }
    }
  }

  const end = await closeAllAtEnd({ runId, positions, candleCache, lastDayMs: Date.parse(`${run.endDate}T23:00:00Z`) });
  equity += end.equityDelta; closed += end.closed;
  return { opened, closed };
}
