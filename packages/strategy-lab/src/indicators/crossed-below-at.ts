import type { Candle } from "../types";

export function crossedBelowAt(candles: Candle[], index: number, level: number): boolean {
  if (index <= 0 || index >= candles.length) return false;
  return candles[index - 1].c >= level && candles[index].c < level;
}
