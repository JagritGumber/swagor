import type { Candle } from "../../types";
import { sma } from "./sma";

export function atr(candles: Candle[], length: number): number | null {
  if (candles.length <= length) return null;
  const ranges: number[] = [];
  for (let i = candles.length - length; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];
    ranges.push(Math.max(
      current.h - current.l,
      Math.abs(current.h - previous.c),
      Math.abs(current.l - previous.c),
    ));
  }
  return sma(ranges, length);
}
