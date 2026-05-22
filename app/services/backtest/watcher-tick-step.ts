import type { Candle } from "@/lib/data-sources/hyperliquid";
import { checkStopTpHit, trailingStopHit, type CloseSink, type OpenPos } from "./simulate-helpers";
import { nextCandleAfter, entryFill, exitFill } from "./backtest-fills";
import type { WatcherDecision } from "@/app/services/watcher/selbo-tick-types";
import { decideSelboTick } from "@/app/services/watcher/selbo-agent-decision";
import { backtestTickInput } from "./backtest-tick-input";

export const STOP_COOLDOWN_MS = 6 * 3_600_000;

/** Mutable replay state threaded across hourly ticks. */
export type ReplayCtx = {
  runId: string; assets: string[]; candleCache: Map<string, Candle[]>;
  positions: Map<string, OpenPos>; equity: number; opened: number; closed: number;
  currentDayMs: number; dailyTradeCount: number; dailyLossCount: number; dailyRealizedPnlUsd: number;
  cooldownUntil: Record<string, string>; writeClose: CloseSink;
  strategyText?: string; recentLessons?: string[];
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
    const pnlUsd = await ctx.writeClose({ asset, pos, exitDate: new Date(next ? next.t : tickMs), exitPrice, reason: hit.reason });
    if (hit.reason === "stop_loss") ctx.cooldownUntil[`${asset.toUpperCase()}:${pos.side}`] = new Date(tickMs + STOP_COOLDOWN_MS).toISOString();
    bookClose(ctx, asset, pnlUsd);
  }

  const decision = await decideSelboTick(backtestTickInput(ctx, tickMs));
  if ((decision.action === "close" || decision.action === "risk_emergency") && decision.asset) {
    const asset = decision.asset.toUpperCase();
    const pos = ctx.positions.get(asset);
    const next = nextCandleAfter(ctx.candleCache.get(asset) ?? [], tickMs);
    if (pos && next) {
      const reason = decision.blockedReasons.includes("stale_position") ? "time_stop" : decision.action;
      const pnlUsd = await ctx.writeClose({ asset, pos, exitDate: new Date(next.t), exitPrice: exitFill(pos.side, Number(next.o)), reason });
      bookClose(ctx, asset, pnlUsd);
    }
  }
  if ((decision.action === "open_long" || decision.action === "open_short") && decision.asset) {
    const asset = decision.asset.toUpperCase();
    const next = nextCandleAfter(ctx.candleCache.get(asset) ?? [], tickMs);
    const side = decision.action === "open_long" ? "long" : "short";
    const pos = next ? openFromDecision(decision, entryFill(side, Number(next.o)), next.t, ctx.equity) : null;
    if (pos) { ctx.positions.set(asset, pos); ctx.opened++; ctx.dailyTradeCount++; }
  }
}
