import type { Candle } from "../../types";

export function closeAt(candles: Candle[], index: number): number | null {
  if (index < 0 || index >= candles.length) return null;
  return candles[index].c;
}

