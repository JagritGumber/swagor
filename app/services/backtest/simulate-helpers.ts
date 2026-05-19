import { db } from "@/lib/db/client";
import { backtestTrades } from "@/lib/db/schema";
import type { Candle } from "@/lib/data-sources/hyperliquid";
import type { TradeQualityReport } from "@/app/services/trade-quality-engine";

export const STARTING_EQUITY_USD = 1000;

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
  runId: string;
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
    equityDelta += await writeBacktestClose({
      runId: input.runId, asset, pos,
      exitDate: new Date(input.lastDayMs), exitPrice: price, reason: "end_of_backtest",
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

export function computePnl(
  side: "long" | "short", entry: number, exit: number,
  sizeUsd: number, leverage: number,
): { pnlUsd: number; pnlPct: number } {
  const move = side === "long" ? (exit - entry) / entry : (entry - exit) / entry;
  return { pnlUsd: sizeUsd * leverage * move, pnlPct: leverage * move * 100 };
}

/** Persist a closed simulated trade; returns realized PnL for the caller's compounding counter. */
export async function writeBacktestClose(input: {
  runId: string; asset: string; pos: OpenPos;
  exitDate: Date; exitPrice: number; reason: string;
}): Promise<number> {
  const { pnlUsd, pnlPct } = computePnl(input.pos.side, input.pos.entryPrice, input.exitPrice, input.pos.sizeUsd, input.pos.leverage);
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
