import type { Candle } from "../../types";

export function closes(candles: Candle[]): number[] {
  return candles.map((candle) => candle.c);
}


