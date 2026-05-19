import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { backtestRuns, backtestTrades, dailyPlans, rebalanceCycles } from "@/lib/db/schema";
import { fetchCandles, type Candle } from "@/lib/data-sources/hyperliquid";
import { checkStopTpHit, closeAllAtEnd, computePnl, type OpenPos, STARTING_EQUITY_USD, writeBacktestClose } from "./simulate-helpers";
import { evaluatePerpRisk } from "@/app/services/risk-engine.service";
import { evaluateSelboTick, type SelboTickInput, type WatcherDecision } from "@/app/services/watcher/selbo-tick-engine";
import { atrPct, closes, ema, realizedVolPct, rsiWilder, type MarketFeatureSnapshot, type SymbolMarketFeatures, type TimeframeFeature } from "@/lib/market-features";
import { computeVolumeProfile } from "@/lib/volume-profile";
import { buildPerpMarketState } from "@/lib/perp-market-state";

export { summarizeBacktestTrades, type BacktestSummary } from "./summarize-trades";

type PlanJson = { watchlist?: string[] };

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

function finiteClose(c: Candle | undefined): number | null {
  const n = Number(c?.c);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function trendOf(e20: number | null, e50: number | null): TimeframeFeature["emaTrend"] {
  if (e20 === null || e50 === null || e50 === 0) return "unknown";
  const spread = (e20 - e50) / e50;
  if (Math.abs(spread) < 0.0015) return "flat";
  return spread > 0 ? "bullish" : "bearish";
}

function tf(name: TimeframeFeature["timeframe"], candles: Candle[]): TimeframeFeature {
  const cls = closes(candles);
  const e20 = ema(cls, 20);
  const e50 = ema(cls, 50);
  return {
    timeframe: name, featureQuality: cls.length >= 20 ? "fresh" : "partial",
    lastCandleAt: candles.at(-1) ? new Date(candles.at(-1)!.t).toISOString() : null,
    candlesUsed: cls.length, missingReasons: cls.length < 20 ? ["limited historical candles"] : [],
    rsi14: rsiWilder(cls), ema20: e20, ema50: e50,
    emaTrend: trendOf(e20, e50), atrPct: atrPct(candles),
    realizedVolPct: realizedVolPct(cls), marketRegime: "unknown",
  };
}

function buildSnapshotAt(assets: string[], cache: Map<string, Candle[]>, tickMs: number): MarketFeatureSnapshot {
  const symbols: SymbolMarketFeatures[] = assets.flatMap((asset) => {
    const history = (cache.get(asset) ?? []).filter((c) => c.t <= tickMs).slice(-120);
    const last = history.at(-1);
    const mid = finiteClose(last);
    if (mid === null) return [];
    const recentCandles = history.slice(-20).map((c) => ({
      t: c.t, o: Number(c.o), h: Number(c.h), l: Number(c.l), c: Number(c.c), v: Number(c.v),
    }));
    const volumeProfile = computeVolumeProfile(recentCandles);
    const timeframes = { "5m": tf("5m", history), "1h": tf("1h", history), "4h": tf("4h", history), "1d": tf("1d", history) };
    const state = buildPerpMarketState({
      strategyMode: "scalper", symbol: asset, mid, fundingHourly: null,
      openInterestChangeHint: "unknown", openInterestDeltas: { last5m: null, last1h: null, last4h: null },
      recentCandles, timeframes,
      volumeProfile: {
        vwap: volumeProfile.vwap, poc: volumeProfile.poc, vah: volumeProfile.vah,
        val: volumeProfile.val, swingHigh: volumeProfile.swingHigh, swingLow: volumeProfile.swingLow,
      },
    });
    return [{
      symbol: asset, mid, mark: mid, fundingHourly: null, openInterest: null,
      openInterestChangeHint: "unknown" as const,
      openInterestDeltas: { last5m: null, last1h: null, last4h: null },
      recentCandles, timeframes,
      candidateBias: "unknown" as const,
      cadenceHint: "normal" as const,
      cadenceReason: "historical watcher replay",
      volumeProfile: {
        vwap: volumeProfile.vwap, poc: volumeProfile.poc, vah: volumeProfile.vah,
        val: volumeProfile.val, swingHigh: volumeProfile.swingHigh, swingLow: volumeProfile.swingLow,
      },
      perpMarketState: state,
    }];
  });
  return { source: "hyperliquid-testnet", generatedAt: new Date(tickMs).toISOString(), symbols, skippedSymbols: [] };
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
  const allAssets = Array.from(new Set(plans.flatMap((p) => (p.planJson as PlanJson | null)?.watchlist?.map((a) => a.toUpperCase()) ?? ["BTC", "ETH", "SOL"])));
  const candleCache = new Map<string, Candle[]>();
  for (const a of allAssets) candleCache.set(a, await fetchCandles(a, "1h", startMs - 7 * 86_400_000, endMs));

  let equity = STARTING_EQUITY_USD;
  let opened = 0, closed = 0;
  const positions = new Map<string, OpenPos>();

  for (let tickMs = startMs; tickMs <= Date.parse(`${run.endDate}T23:00:00Z`); tickMs += 3_600_000) {
    const dayMs = Date.UTC(new Date(tickMs).getUTCFullYear(), new Date(tickMs).getUTCMonth(), new Date(tickMs).getUTCDate());
    if (!cycleDays.includes(dayMs)) continue;
    const plan = planByDay.get(dayMs);
    if (!plan) continue;
    for (const [asset, pos] of [...positions]) {
      const candle = (candleCache.get(asset) ?? []).find((c) => c.t === tickMs) ?? null;
      const hit = candle ? checkStopTpHit(pos, candle) : null;
      if (!hit) continue;
      const { pnlUsd } = computePnl(pos.side, pos.entryPrice, hit.price, pos.sizeUsd, pos.leverage);
      await writeBacktestClose({ runId, asset, pos, exitDate: new Date(tickMs), exitPrice: hit.price, reason: hit.reason });
      positions.delete(asset); equity += pnlUsd; closed++;
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
      externalSentiment: plan.planJson as SelboTickInput["externalSentiment"] ?? null,
      marketFeatures,
      positions: [...positions].map(([asset, pos]) => ({
        asset, side: pos.side, entryPrice: pos.entryPrice,
        markPrice: Number((candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c),
        sizeUsd: pos.sizeUsd,
      })),
      risk,
      recentLessons: [],
    };
    const decision = evaluateSelboTick(tickInput);
    if ((decision.action === "close" || decision.action === "risk_emergency") && decision.asset) {
      const asset = decision.asset.toUpperCase();
      const pos = positions.get(asset);
      const price = Number((candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c);
      if (pos && Number.isFinite(price)) {
        const { pnlUsd } = computePnl(pos.side, pos.entryPrice, price, pos.sizeUsd, pos.leverage);
        await writeBacktestClose({ runId, asset, pos, exitDate: new Date(tickMs), exitPrice: price, reason: decision.action });
        positions.delete(asset); equity += pnlUsd; closed++;
      }
    }
    if ((decision.action === "open_long" || decision.action === "open_short") && decision.asset) {
      const asset = decision.asset.toUpperCase();
      const price = Number((candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c);
      const pos = Number.isFinite(price) ? openFromDecision(decision, price, tickMs, equity) : null;
      if (pos) { positions.set(asset, pos); opened++; }
    }
  }

  const end = await closeAllAtEnd({ runId, positions, candleCache, lastDayMs: Date.parse(`${run.endDate}T23:00:00Z`) });
  equity += end.equityDelta; closed += end.closed;
  return { opened, closed };
}
