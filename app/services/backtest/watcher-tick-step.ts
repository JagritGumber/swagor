import type { Candle } from "@/lib/data-sources/hyperliquid";
import { checkStopTpHit, type CloseSink, type OpenPos } from "./simulate-helpers";
import { evaluatePerpRisk } from "@/app/services/risk-engine.service";
import { evaluateSelboTick, type SelboTickInput, type WatcherDecision, type WatcherExecutionState } from "@/app/services/watcher/selbo-tick-engine";
import { deterministicPressureSnapshot } from "./deterministic-pressure";
import { buildSnapshotAt } from "./backtest-snapshot";

export const STOP_COOLDOWN_MS = 6 * 3_600_000;

/** Mutable replay state threaded across hourly ticks. */
export type ReplayCtx = {
  runId: string; assets: string[]; candleCache: Map<string, Candle[]>;
  positions: Map<string, OpenPos>; equity: number; opened: number; closed: number;
  currentDayMs: number; dailyTradeCount: number; dailyLossCount: number; dailyRealizedPnlUsd: number;
  cooldownUntil: Record<string, string>; writeClose: CloseSink;
};

function openFromDecision(d: WatcherDecision, price: number, dayMs: number, equity: number): OpenPos | null {
  if (!d.asset || (d.action !== "open_long" && d.action !== "open_short")) return null;
  if (d.stopLossPriceUsd === null || d.takeProfitPriceUsd === null) return null;
  return {
    side: d.action === "open_long" ? "long" : "short", entryDate: new Date(dayMs), entryPrice: price,
    sizeUsd: d.sizeUsd || Math.min(100, equity * 0.1), leverage: d.leverage, confidence: d.confidence,
    stopPrice: d.stopLossPriceUsd, tpPrice: d.takeProfitPriceUsd,
    thesisId: `${d.asset}:${new Date(dayMs).toISOString()}:watcher`, entryReason: d.reason, invalidatesIf: null,
    setupType: d.marketTrigger, invalidationSource: null,
    qualityReport: null, watcherDecision: d as unknown as Record<string, unknown>,
  };
}

function priceAt(ctx: ReplayCtx, asset: string, tickMs: number): number {
  return Number((ctx.candleCache.get(asset) ?? []).find((c) => c.t === tickMs)?.c);
}

function bookClose(ctx: ReplayCtx, asset: string, pnlUsd: number): void {
  ctx.positions.delete(asset); ctx.equity += pnlUsd; ctx.closed++;
  ctx.dailyRealizedPnlUsd += pnlUsd;
  if (pnlUsd < 0) ctx.dailyLossCount++;
}

/**
 * One hourly tick, shared by the swarm-gated backtest and the
 * continuous long replay. canTrade=false replicates the old per-tick
 * `continue` (still resets daily counters at the UTC day boundary).
 */
export async function stepWatcherTick(ctx: ReplayCtx, tickMs: number, canTrade: boolean): Promise<void> {
  const dayMs = Date.UTC(new Date(tickMs).getUTCFullYear(), new Date(tickMs).getUTCMonth(), new Date(tickMs).getUTCDate());
  if (dayMs !== ctx.currentDayMs) {
    ctx.currentDayMs = dayMs; ctx.dailyTradeCount = 0; ctx.dailyLossCount = 0; ctx.dailyRealizedPnlUsd = 0;
  }
  if (!canTrade) return;

  for (const [asset, pos] of [...ctx.positions]) {
    const candle = (ctx.candleCache.get(asset) ?? []).find((c) => c.t === tickMs) ?? null;
    const hit = candle ? checkStopTpHit(pos, candle) : null;
    if (!hit) continue;
    const pnlUsd = await ctx.writeClose({ asset, pos, exitDate: new Date(tickMs), exitPrice: hit.price, reason: hit.reason });
    if (hit.reason === "stop_loss") ctx.cooldownUntil[`${asset.toUpperCase()}:${pos.side}`] = new Date(tickMs + STOP_COOLDOWN_MS).toISOString();
    bookClose(ctx, asset, pnlUsd);
  }

  const marketFeatures = buildSnapshotAt(ctx.assets, ctx.candleCache, tickMs);
  const risk = evaluatePerpRisk({
    account: { equityUsd: ctx.equity, withdrawableUsd: ctx.equity },
    positions: [...ctx.positions].map(([asset, pos]) => {
      const price = priceAt(ctx, asset, tickMs);
      return { source: "paper" as const, asset, side: pos.side, sizeUsd: pos.sizeUsd, entryPrice: pos.entryPrice, markPrice: Number.isFinite(price) ? price : null };
    }),
  });
  const tickInput: SelboTickInput = {
    mode: "backtest", asOf: new Date(tickMs).toISOString(), strategyText: "",
    externalSentiment: deterministicPressureSnapshot(marketFeatures), marketFeatures,
    positions: [...ctx.positions].map(([asset, pos]) => ({
      asset, side: pos.side, entryPrice: pos.entryPrice, markPrice: priceAt(ctx, asset, tickMs),
      sizeUsd: pos.sizeUsd, openedAt: pos.entryDate.toISOString(),
    })),
    risk, recentLessons: [],
    executionState: {
      dailyTradeCount: ctx.dailyTradeCount, dailyLossCount: ctx.dailyLossCount,
      dailyRealizedPnlUsd: ctx.dailyRealizedPnlUsd, assetSideCooldownUntil: ctx.cooldownUntil,
    } satisfies WatcherExecutionState,
  };
  const decision = evaluateSelboTick(tickInput);
  if ((decision.action === "close" || decision.action === "risk_emergency") && decision.asset) {
    const asset = decision.asset.toUpperCase();
    const pos = ctx.positions.get(asset);
    const price = priceAt(ctx, asset, tickMs);
    if (pos && Number.isFinite(price)) {
      const reason = decision.blockedReasons.includes("stale_position") ? "time_stop" : decision.action;
      const pnlUsd = await ctx.writeClose({ asset, pos, exitDate: new Date(tickMs), exitPrice: price, reason });
      bookClose(ctx, asset, pnlUsd);
    }
  }
  if ((decision.action === "open_long" || decision.action === "open_short") && decision.asset) {
    const asset = decision.asset.toUpperCase();
    const price = priceAt(ctx, asset, tickMs);
    const pos = Number.isFinite(price) ? openFromDecision(decision, price, tickMs, ctx.equity) : null;
    if (pos) { ctx.positions.set(asset, pos); ctx.opened++; ctx.dailyTradeCount++; }
  }
}
