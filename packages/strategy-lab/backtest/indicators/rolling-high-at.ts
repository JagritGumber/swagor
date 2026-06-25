import type { Candle } from "../../types";

export function rollingHighAt(candles: Candle[], index: number, length: number): number | null {
  if (length <= 0 || index < length - 1 || index >= candles.length) return null;
  let high = Number.NEGATIVE_INFINITY;
  for (let i = index - length + 1; i <= index; i++) {
    high = Math.max(high, candles[i].h);
  }
  return high;
}


