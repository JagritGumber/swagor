import { fetchHyperliquidCandles } from "./fetch-hyperliquid-candles";
import { intervalMs } from "../shared/interval-ms";
import type { CandleQuery, HyperliquidCandle } from "../shared/types";

const PAGE_LIMIT = 5000;

export async function fetchHyperliquidCandlesPaginated(query: CandleQuery): Promise<HyperliquidCandle[]> {
  const step = intervalMs(query.interval);
  const seen = new Set<number>();
  const out: HyperliquidCandle[] = [];
  let cursor = query.startMs;

  while (cursor < query.endMs) {
    const windowEnd = Math.min(query.endMs, cursor + step * PAGE_LIMIT);
    const page = await fetchHyperliquidCandles({ ...query, startMs: cursor, endMs: windowEnd });
    if (page.length === 0) {
      cursor = windowEnd;
      continue;
    }

    let maxT = cursor;
    for (const candle of page) {
      if (!seen.has(candle.t)) {
        seen.add(candle.t);
        out.push(candle);
      }
      if (candle.t > maxT) maxT = candle.t;
    }

    const next = maxT + step;
    if (next <= cursor) break;
    cursor = next;
  }

  out.sort((a, b) => a.t - b.t);
  return out;
}

