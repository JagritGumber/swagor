import { stopTpForSide, computePnl, type OpenPos } from "./simulate-helpers";

export type BacktestCloseEvent = { asset: string; pos: OpenPos; exitDate: Date; exitPrice: number; reason: string };

/** Vol-scaled stop/TP. Engine math; LLM doesn't touch this. */
export function deterministicRiskPct(vol: number | undefined): { stopPct: number; tpPct: number } {
  if (vol === undefined) return { stopPct: 4, tpPct: 8 };
  const stopPct = Math.min(7, Math.max(3, 1.5 * vol));
  return { stopPct, tpPct: 2 * stopPct };
}

/** Clamp a model-supplied advisory value within +/- 20% of the deterministic compute. */
export function clampOverride(model: number | undefined, deterministic: number): number {
  if (model === undefined) return deterministic;
  return Math.max(deterministic * 0.8, Math.min(deterministic * 1.2, model));
}

export function openPosition(asset: string, side: "long" | "short", price: number, dayMs: number, equity: number, notionalPct: number, leverage: number, confidence: number, reason: string, invalidatesIf: string | null, stopPct: number, tpPct: number): OpenPos {
  const { stop, tp } = stopTpForSide(side, price, stopPct, tpPct);
  const entryDate = new Date(dayMs);
  return {
    side, entryDate, entryPrice: price, sizeUsd: equity * notionalPct / 100,
    leverage, confidence, stopPrice: stop, tpPrice: tp,
    thesisId: `${asset}:${entryDate.toISOString()}:${side}`, entryReason: reason, invalidatesIf,
  };
}

/**
 * Partial harvest. Closes half the position at today's close, tightens
 * the remaining stop to break-even. Guarded: only executes when the
 * position's current unrealized % is at least 75% of its TP target.
 * Otherwise logs and skips so the model can't randomly profit-take at
 * break-even noise.
 */
export function tryReduce(asset: string, pos: OpenPos, price: number, dayMs: number, equity: number, closes: BacktestCloseEvent[], generatedAt: Date): number {
  const unrealizedPct = pos.side === "long" ? (price - pos.entryPrice) / pos.entryPrice * 100 : (pos.entryPrice - price) / pos.entryPrice * 100;
  const tpTargetPct = Math.abs((pos.tpPrice - pos.entryPrice) / pos.entryPrice * 100);
  if (unrealizedPct < 0.75 * tpTargetPct) {
    console.warn(`[backtest-sim] reduce ignored on ${asset} ${generatedAt.toISOString()}: unrealizedPct=${unrealizedPct.toFixed(2)}% below 75% of TP target ${tpTargetPct.toFixed(2)}%`);
    return equity;
  }
  const halfSize = pos.sizeUsd / 2;
  const { pnlUsd } = computePnl(pos.side, pos.entryPrice, price, halfSize, pos.leverage);
  closes.push({ asset, pos: { ...pos, sizeUsd: halfSize }, exitDate: new Date(dayMs), exitPrice: price, reason: "thesis_reduced" });
  pos.sizeUsd = halfSize;
  pos.stopPrice = pos.entryPrice;
  return equity + pnlUsd;
}
