import type { Candle } from "@strategy-lab/types";

export function rollingLow(candles: Candle[], length: number): number | null {
  if (candles.length < length) return null;
  let low = Number.POSITIVE_INFINITY;
  for (let i = candles.length - length; i < candles.length; i++) {
    low = Math.min(low, candles[i].l);
  }
  return low;
}


