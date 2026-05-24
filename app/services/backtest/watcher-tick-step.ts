import type { Candle } from "@/lib/data-sources/hyperliquid";
import { checkStopTpHit, trailingStopHit, type CloseSink, type OpenPos } from "./simulate-helpers";
import { nextCandleAfter, entryFill, exitFill } from "./backtest-fills";
import type { WatcherDecision } from "@/app/services/watcher/selbo-tick-types";
import { decideSelboTick } from "@/app/services/watcher/selbo-agent-decision";
import { backtestTickInput } from "./backtest-tick-input";
import { deriveEntryState, computeInitialRiskUsd } from "@/app/services/setup-fingerprint";
import type { InMemoryStore } from "@/app/services/setup-fingerprint/in-memory";
import { recordCloseToStore } from "./replay-recording";

export const STOP_COOLDOWN_MS = 6 * 3_600_000;

/** Mutable replay state threaded across hourly ticks. */
export type ReplayCtx = {
  runId: string; assets: string[]; candleCache: Map<string, Candle[]>;
  positions: Map<string, OpenPos>; equity: number; opened: number; closed: number;
  currentDayMs: number; dailyTradeCount: number; dailyLossCount: number; dailyRealizedPnlUsd: number;
  cooldownUntil: Record<string, string>; writeClose: CloseSink;
  strategyText?: string;
  // In-memory mirror of the live setup_records table. recordOutcomeInMemory
  // mutates this byte-identically to how the live SQL upsert mutates the DB.
  fpStore: InMemoryStore;
};

function openFromDecision(d: WatcherDecision, price: number, dayMs: number, equity: number, fingerprint: string | null, entryStateSnapshot: OpenPos["entryStateSnapshot"]): OpenPos | null {
  if (!d.asset || (d.action !== "open_long" && d.action !== "open_short")) return null;
  if (d.stopLossPriceUsd === null || d.takeProfitPriceUsd === null) return null;
  const side: OpenPos["side"] = d.action === "open_long" ? "long" : "short";
  const sizeUsd = d.sizeUsd || Math.min(100, equity * 0.1);
  return {
    side, entryDate: new Date(dayMs), entryPrice: price,
    sizeUsd, leverage: d.leverage, confidence: d.confidence,
    stopPrice: d.stopLossPriceUsd, tpPrice: d.takeProfitPriceUsd,
    thesisId: `${d.asset}:${new Date(dayMs).toISOString()}:watcher`, entryReason: d.reason, invalidatesIf: null,
    setupType: d.marketTrigger, invalidationSource: null,
    qualityReport: null, watcherDecision: d as unknown as Record<string, unknown>,
    fingerprint, entryStateSnapshot,
    initialRiskUsd: computeInitialRiskUsd({ side, entryPrice: price, stopPrice: d.stopLossPriceUsd, sizeUsd }),
  };
}

function bookClose(ctx: ReplayCtx, asset: string, pnlUsd: number): void {
  ctx.positions.delete(asset); ctx.equity += pnlUsd; ctx.closed++;
  ctx.dailyRealizedPnlUsd += pnlUsd;
  if (pnlUsd < 0) ctx.dailyLossCount++;
}

/**
 * One hourly replay tick. Realistic fills: a decision seen on this candle's
 * close fills at the NEXT candle's open with adverse slippage (backtest-fills),
 * never the same candle it was decided on. canTrade=false still resets the
 * daily counters at the UTC day boundary.
 */
export async function stepWatcherTick(ctx: ReplayCtx, tickMs: number, canTrade: boolean): Promise<void> {
  const dayMs = Date.UTC(new Date(tickMs).getUTCFullYear(), new Date(tickMs).getUTCMonth(), new Date(tickMs).getUTCDate());
  if (dayMs !== ctx.currentDayMs) {
    ctx.currentDayMs = dayMs; ctx.dailyTradeCount = 0; ctx.dailyLossCount = 0; ctx.dailyRealizedPnlUsd = 0;
  }
  if (!canTrade) return;

  for (const [asset, pos] of [...ctx.positions]) {
    const candles = ctx.candleCache.get(asset) ?? [];
    const candle = candles.find((c) => c.t === tickMs) ?? null;
    if (!candle) continue;
    const close = Number(candle.c);
    pos.peakPrice = pos.side === "long"
      ? Math.max(pos.peakPrice ?? pos.entryPrice, close)
      : Math.min(pos.peakPrice ?? pos.entryPrice, close);
    const hit = checkStopTpHit(pos, candle) ?? (trailingStopHit(pos, close) ? { price: close, reason: "trailing_stop" } : null);
    if (!hit) continue;
    const next = nextCandleAfter(candles, tickMs);
    const exitPrice = next ? exitFill(pos.side, Number(next.o)) : hit.price;
    const exitTickMs = next ? next.t : tickMs;
    const pnlUsd = await ctx.writeClose({ asset, pos, exitDate: new Date(exitTickMs), exitPrice, reason: hit.reason });
    if (hit.reason === "stop_loss") ctx.cooldownUntil[`${asset.toUpperCase()}:${pos.side}`] = new Date(tickMs + STOP_COOLDOWN_MS).toISOString();
    recordCloseToStore({ fpStore: ctx.fpStore, candleCache: ctx.candleCache, asset, pos, pnlUsd, hitReason: hit.reason, exitTickMs });
    bookClose(ctx, asset, pnlUsd);
  }

  const tickInput = backtestTickInput(ctx, tickMs);
  const decision = await decideSelboTick(tickInput);
  if ((decision.action === "close" || decision.action === "risk_emergency") && decision.asset) {
    const asset = decision.asset.toUpperCase();
    const pos = ctx.positions.get(asset);
    const next = nextCandleAfter(ctx.candleCache.get(asset) ?? [], tickMs);
    if (pos && next) {
      const reason = decision.blockedReasons.includes("stale_position") ? "time_stop" : decision.action;
      const exitPrice = exitFill(pos.side, Number(next.o));
      const pnlUsd = await ctx.writeClose({ asset, pos, exitDate: new Date(next.t), exitPrice, reason });
      recordCloseToStore({ fpStore: ctx.fpStore, candleCache: ctx.candleCache, asset, pos, pnlUsd, hitReason: reason, exitTickMs: next.t });
      bookClose(ctx, asset, pnlUsd);
    }
  }
  if ((decision.action === "open_long" || decision.action === "open_short") && decision.asset) {
    const asset = decision.asset.toUpperCase();
    const next = nextCandleAfter(ctx.candleCache.get(asset) ?? [], tickMs);
    const side = decision.action === "open_long" ? "long" : "short";
    const fingerprint = tickInput.symbolFingerprints?.get(asset)?.[side] ?? null;
    const symbolFeatures = tickInput.marketFeatures.symbols.find((s) => s.symbol === asset);
    const entryStateSnapshot = symbolFeatures ? deriveEntryState(symbolFeatures.perpMarketState, symbolFeatures.recentCandles) : null;
    const pos = next ? openFromDecision(decision, entryFill(side, Number(next.o)), next.t, ctx.equity, fingerprint, entryStateSnapshot) : null;
    if (pos) { ctx.positions.set(asset, pos); ctx.opened++; ctx.dailyTradeCount++; }
  }
}
