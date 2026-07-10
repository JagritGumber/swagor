import type { Candle } from "@strategy-lab/types";

export function atrAt(candles: Candle[], index: number, length: number): number | null {
  if (length <= 0 || index < length || index >= candles.length) return null;
  let sum = 0;
  for (let i = index - length + 1; i <= index; i++) {
    const current = candles[i];
    const previous = candles[i - 1];
    sum += Math.max(
      current.h - current.l,
      Math.abs(current.h - previous.c),
      Math.abs(current.l - previous.c),
    );
  }
  return sum / length;
}


