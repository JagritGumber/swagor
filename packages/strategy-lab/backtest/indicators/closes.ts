import type { Candle } from "@strategy-lab/types";

export function closes(candles: Candle[]): number[] {
  return candles.map((candle) => candle.c);
}


