import type { Candle } from "../../types";

export function candleIndexForTime(input: {
  candles: Candle[];
  candleIntervalMs: number;
  time: number;
}): number {
  let low = 0;
  let high = input.candles.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const closeTime = input.candles[mid].t + input.candleIntervalMs;
    if (closeTime <= input.time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}


