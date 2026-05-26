import type { Candle } from "../types";

export function rollingHigh(candles: Candle[], length: number): number | null {
  if (candles.length < length) return null;
  let high = Number.NEGATIVE_INFINITY;
  for (let i = candles.length - length; i < candles.length; i++) {
    high = Math.max(high, candles[i].h);
  }
  return high;
}
