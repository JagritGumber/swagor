import { retry, hlRateLimit } from '../../../alova'
import { getCandles } from '../../../alova/methods/hyperliquid.ts'
import { intervalMs } from "../shared/interval-ms";
import type { CandleQuery, HyperliquidCandle } from "../shared/types";
import { validateHyperliquidCandles } from "./validate-hyperliquid-candles";

const PAGE_LIMIT = 5000;

export async function fetchHyperliquidCandlesPaginated(query: CandleQuery): Promise<HyperliquidCandle[]> {
  const step = intervalMs(query.interval);
  const seen = new Set<number>();
  const out: HyperliquidCandle[] = [];
  let cursor = query.startMs;

  while (cursor < query.endMs) {
    const windowEnd = Math.min(query.endMs, cursor + step * PAGE_LIMIT);
    const method = getCandles(query.network, query.asset.toUpperCase(), query.interval, cursor, windowEnd);
    const limited = hlRateLimit(method, { key: 'hl' });
    const hooked = retry(limited, {
      retry: 3,
      backoff: { delay: 1000, multiplier: 2, startQuiver: 0.3, endQuiver: 0.7 },
    });
    const page = validateHyperliquidCandles(await hooked.send());
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
