import type { Candle } from "../types";

export function smaAt(candles: Candle[], index: number, length: number): number | null {
  if (length <= 0 || index < length - 1 || index >= candles.length) return null;
  let sum = 0;
  for (let i = index - length + 1; i <= index; i++) {
    sum += candles[i].c;
  }
  return sum / length;
}
