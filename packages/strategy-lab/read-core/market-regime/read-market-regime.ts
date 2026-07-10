import type { Candle } from "@strategy-lab/types";
import type { ReaderMarketRegime } from "./types";
import { classifyCandles } from "./classify-candles";

export function readMarketRegime(input: {
  candles: Candle[];
  now: number;
}): ReaderMarketRegime {
  const session = currentUtcDayCandles(input.candles, input.now);
  return classifyCandles(session);
}

function currentUtcDayCandles(candles: Candle[], now: number): Candle[] {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const start = dayStart.getTime();
  return candles.filter(c => c.t >= start && c.t <= now);
}
