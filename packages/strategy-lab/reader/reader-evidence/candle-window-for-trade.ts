import { candleIndexForTime } from "./candle-index-for-time";
import type { ReaderCandleEvidence, ReaderCandleStats } from "./types";
import type { ReaderResultEntry, ReaderResultOutcome } from "../reader-result/types";
import type { Candle } from "../../types";

export function candleWindowForTrade(input: {
  candles: Candle[];
  candleIntervalMs: number;
  entry: ReaderResultEntry;
  outcome: ReaderResultOutcome | null;
  beforeEntryCandles: number;
  afterExitCandles: number;
}): ReaderCandleEvidence {
  const entryIndex = candleIndexForTime({
    candles: input.candles,
    candleIntervalMs: input.candleIntervalMs,
    time: input.entry.entryAt,
  });
  const exitIndex = input.outcome
    ? candleIndexForTime({
        candles: input.candles,
        candleIntervalMs: input.candleIntervalMs,
        time: input.outcome.exitAt,
      })
    : -1;

  const beforeStart = Math.max(0, entryIndex - input.beforeEntryCandles + 1);
  const beforeEntry = entryIndex >= 0 ? input.candles.slice(beforeStart, entryIndex + 1) : [];
  const afterExit = input.outcome && exitIndex >= 0
    ? input.candles.slice(exitIndex + 1, exitIndex + 1 + input.afterExitCandles)
    : [];

  return {
    beforeEntry,
    entryClosedCandle: entryIndex >= 0 ? input.candles[entryIndex] : null,
    exitClosedCandle: exitIndex >= 0 ? input.candles[exitIndex] : null,
    afterExit,
    stats: candleStats({ beforeEntry, afterExit, entryPrice: input.entry.entryPrice }),
  };
}

function candleStats(input: {
  beforeEntry: Candle[];
  afterExit: Candle[];
  entryPrice: number;
}): ReaderCandleStats {
  const preHigh = highOf(input.beforeEntry);
  const preLow = lowOf(input.beforeEntry);
  const entryClosePosition = preHigh === null || preLow === null || preHigh === preLow
    ? null
    : Number(clamp((input.entryPrice - preLow) / (preHigh - preLow), 0, 1).toFixed(4));

  return {
    high: preHigh,
    low: preLow,
    volume: Number(input.beforeEntry.reduce((sum, candle) => sum + candle.v, 0).toFixed(4)),
    range: preHigh === null || preLow === null ? null : Number((preHigh - preLow).toFixed(4)),
    entryClosePosition,
    postExitHigh: highOf(input.afterExit),
    postExitLow: lowOf(input.afterExit),
  };
}

function highOf(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  return Math.max(...candles.map((candle) => candle.h));
}

function lowOf(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  return Math.min(...candles.map((candle) => candle.l));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}



