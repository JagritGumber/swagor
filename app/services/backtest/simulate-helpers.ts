import { db } from "@/lib/db/client";
import { backtestTrades } from "@/lib/db/schema";
import type { Candle } from "@/lib/data-sources/hyperliquid";
import type { TradeQualityReport } from "@/app/services/trade-quality-engine";

export const STARTING_EQUITY_USD = 1000;
const BACKTEST_ROUND_TRIP_COST_USD = 0.1;

/** A close-sink records one closed trade and returns its realized PnL.
 * The app injects a DB writer; the local harness injects an in-memory
 * collector. Single shape so both share the trade loop. */
export type CloseSink = (args: { asset: string; pos: OpenPos; exitDate: Date; exitPrice: number; reason: string }) => Promise<number>;

/** thesisId = `${asset}:${entryDateISO}:${side}` — stable across replays. entryReason + invalidatesIf carry the swarm's WHY for the position so future plans can recall it. */
export type OpenPos = {
  side: "long" | "short";
  entryDate: Date; entryPrice: number; sizeUsd: number; leverage: number; confidence: number;
  stopPrice: number; tpPrice: number;
  thesisId: string; entryReason: string; invalidatesIf: string | null;
  strategyMode?: "scalper" | "swing";
  setupType?: string | null;
  invalidationSource?: string | null;
  invalidationLevel?: number | null;
  llmConfidence?: number;
  qualityReport?: TradeQualityReport | null;
  watcherDecision?: Record<string, unknown> | null;
  // Setup-fingerprint stash trio. Computed at open from the same tick
  // marketFeatures the agent saw; read at close to drive recordOutcome
  // against the in-memory store on ReplayCtx.
  fingerprint?: string | null;
  initialRiskUsd?: number | null;
  entryStateSnapshot?: import("@/app/services/setup-fingerprint").EntryStateSnapshot | null;
  // Best favorable price seen since entry; drives the trailing stop.
  peakPrice?: number;
};

export function utcDayMs(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function closeAt(candles: Candle[], dayMs: number): number | null {
  const n = Number(candles.find((cd) => cd.t === dayMs)?.c);
  return Number.isFinite(n) ? n : null;
}

export function candleAt(candles: Candle[], dayMs: number): Candle | null {
  return candles.find((cd) => cd.t === dayMs) ?? null;
}

const STOP_PCT = 0.04;
const TP_PCT = 0.08;

export function stopTpForSide(side: "long" | "short", entry: number, stopPctOverride?: number, tpPctOverride?: number): { stop: number; tp: number } {
  const sp = stopPctOverride !== undefined ? stopPctOverride / 100 : STOP_PCT;
  const tp = tpPctOverride !== undefined ? tpPctOverride / 100 : TP_PCT;
  if (side === "long") return { stop: entry * (1 - sp), tp: entry * (1 + tp) };
  return { stop: entry * (1 + sp), tp: entry * (1 - tp) };
}

export async function closeAllAtEnd(input: {
  writeClose: CloseSink;
  positions: Map<string, OpenPos>;
  candleCache: Map<string, Candle[]>;
  lastDayMs: number;
}): Promise<{ equityDelta: number; closed: number }> {
  let equityDelta = 0;
  let closed = 0;
  for (const [asset, pos] of input.positions) {
    const candles = input.candleCache.get(asset);
    const price = candles ? closeAt(candles, input.lastDayMs) : null;
    if (price === null) continue;
    equityDelta += await input.writeClose({
      asset, pos, exitDate: new Date(input.lastDayMs), exitPrice: price, reason: "end_of_backtest",
    });
    closed++;
  }
  return { equityDelta, closed };
}

/** Stop and TP fire only on a daily close past the level; intraday wicks do not invalidate a multi-day thesis. Exit price is the close (not the stop/tp level) so the realistic adverse-move loss is booked, not the wick price. */
export function checkStopTpHit(pos: OpenPos, candle: Candle): { price: number; reason: string } | null {
  const close = Number(candle.c);
  if (!Number.isFinite(close)) return null;
  const invalidation = pos.invalidationLevel;
  if (typeof invalidation === "number" && Number.isFinite(invalidation)) {
    const thesisHit = pos.side === "long" ? close < invalidation : close > invalidation;
    if (thesisHit) return { price: close, reason: "thesis_invalidated" };
  }
  const stopHit = pos.side === "long" ? close <= pos.stopPrice : close >= pos.stopPrice;
  if (stopHit) return { price: close, reason: "stop_loss" };
  const tpHit = pos.side === "long" ? close >= pos.tpPrice : close <= pos.tpPrice;
  if (tpHit) return { price: close, reason: "take_profit" };
  return null;
}

// Trailing stop: once a position has run TRIGGER past entry, lock profit and
// exit if price gives back GIVEBACK from the best price seen. Critical in
// choppy markets where a good call reverses before the fixed target.
const TRAIL_TRIGGER = 0.025;
const TRAIL_GIVEBACK = 0.02;
export function trailingStopHit(pos: OpenPos, closePx: number): boolean {
  if (!Number.isFinite(closePx)) return false;
  const peak = pos.peakPrice ?? pos.entryPrice;
  if (pos.side === "long") {
    return peak >= pos.entryPrice * (1 + TRAIL_TRIGGER) && closePx <= peak * (1 - TRAIL_GIVEBACK);
  }
  return peak <= pos.entryPrice * (1 - TRAIL_TRIGGER) && closePx >= peak * (1 + TRAIL_GIVEBACK);
}

export function computePnl(
  side: "long" | "short", entry: number, exit: number,
  sizeUsd: number, leverage: number,
): { pnlUsd: number; pnlPct: number } {
  const move = side === "long" ? (exit - entry) / entry : (entry - exit) / entry;
  return { pnlUsd: sizeUsd * leverage * move, pnlPct: leverage * move * 100 };
}

/** Single source of realized close PnL: gross move minus the round-trip
 * cost. Both writeBacktestClose (DB) and the local in-memory sink call
 * this so deployed and local runs book identical numbers. */
export function closeRealizedPnl(pos: OpenPos, exitPrice: number): number {
  const { pnlUsd } = computePnl(pos.side, pos.entryPrice, exitPrice, pos.sizeUsd, pos.leverage);
  return pnlUsd - BACKTEST_ROUND_TRIP_COST_USD;
}

/** Persist a closed simulated trade; returns realized PnL for the caller's compounding counter. */
export async function writeBacktestClose(input: {
  runId: string; asset: string; pos: OpenPos;
  exitDate: Date; exitPrice: number; reason: string;
}): Promise<number> {
  const pnlUsd = closeRealizedPnl(input.pos, input.exitPrice);
  const pnlPct = input.pos.sizeUsd > 0 ? (pnlUsd / input.pos.sizeUsd) * 100 : 0;
  await db.insert(backtestTrades).values({
    backtestRunId: input.runId, asset: input.asset, side: input.pos.side,
    entryDate: input.pos.entryDate, entryPrice: input.pos.entryPrice.toString(),
    exitDate: input.exitDate, exitPrice: input.exitPrice.toString(),
    sizeUsd: input.pos.sizeUsd.toString(),
    pnlUsd: pnlUsd.toString(), pnlPct: pnlPct.toString(),
    biasConfidence: input.pos.confidence.toString(),
    llmConfidence: (input.pos.llmConfidence ?? input.pos.confidence).toString(),
    engineConfidence: input.pos.qualityReport?.engineConfidence.toString() ?? input.pos.confidence.toString(),
    qualityScore: input.pos.qualityReport?.qualityScore.toString() ?? input.pos.confidence.toString(),
    capitalGate: input.pos.qualityReport?.capitalGate ?? "ALLOW_PAPER",
    setupType: input.pos.setupType ?? null,
    invalidationSource: input.pos.invalidationSource ?? null,
    invalidationLevel: input.pos.invalidationLevel?.toString() ?? null,
    rejectReasons: input.pos.qualityReport?.rejectReasons ?? [],
    decisionReport: input.pos.watcherDecision ?? (input.pos.qualityReport ? input.pos.qualityReport as unknown as Record<string, unknown> : null),
    status: "closed", exitReason: input.reason,
  });
  return pnlUsd;
}
