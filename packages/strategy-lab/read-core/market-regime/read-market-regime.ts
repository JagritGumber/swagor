import type { Candle } from "@strategy-lab/types";
import type { ReaderMarketRegime } from "./types";
import { classifyCandles } from "./classify-candles";

export function readMarketRegime(input: {
  candles: Candle[];
  now: number;
}): ReaderMarketRegime {
  const dayStart = new Date(input.now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const start = dayStart.getTime();
  let end = -1;
  for (let i = input.candles.length - 1; i >= 0; i--) {
    if (input.candles[i].t <= input.now) {
      end = i;
      break;
    }
  }
  if (end < 0) return classifyCandles([]);
  let begin = 0;
  for (let i = end; i >= 0; i--) {
    if (input.candles[i].t < start) {
      begin = i + 1;
      break;
    }
  }
  const session = input.candles.slice(begin, end + 1);
  return classifyCandles(session);
}
