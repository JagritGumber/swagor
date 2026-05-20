import { fetchCandles, type Candle } from "./hyperliquid";

const PAGE_LIMIT = 5000;
const INTERVAL_MS: Record<string, number> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000,
  "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
};

/**
 * Paginated candle fetch. Hyperliquid's candleSnapshot returns at most
 * ~5000 candles per request, so a single fetchCandles silently
 * truncates any window longer than that (e.g. ~7 months of hourly data
 * instead of the requested 2 years). This walks forward in
 * 5000-candle windows until [startMs, endMs] is covered, deduping on
 * open time and returning ascending order. Required for long-horizon
 * backtests.
 */
export async function fetchCandlesPaginated(coin: string, interval: string, startMs: number, endMs: number): Promise<Candle[]> {
  const step = INTERVAL_MS[interval] ?? 3_600_000;
  const seen = new Set<number>();
  const out: Candle[] = [];
  let cursor = startMs;
  while (cursor < endMs) {
    const windowEnd = Math.min(endMs, cursor + step * PAGE_LIMIT);
    const page = await fetchCandles(coin, interval, cursor, windowEnd);
    if (page.length === 0) { cursor = windowEnd; continue; }
    let maxT = cursor;
    for (const c of page) {
      if (!seen.has(c.t)) { seen.add(c.t); out.push(c); }
      if (c.t > maxT) maxT = c.t;
    }
    const next = maxT + step;
    if (next <= cursor) break;
    cursor = next;
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}
