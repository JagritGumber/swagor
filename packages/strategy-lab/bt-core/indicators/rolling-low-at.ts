import type { Candle } from "../../types";

export function rollingLowAt(candles: Candle[], index: number, length: number): number | null {
  if (length <= 0 || index < length - 1 || index >= candles.length) return null;
  let low = Number.POSITIVE_INFINITY;
  for (let i = index - length + 1; i <= index; i++) {
    low = Math.min(low, candles[i].l);
  }
  return low;
}

