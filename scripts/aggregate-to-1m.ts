import { readOrderflowBuckets } from "../packages/market-data";
import { writeFile, mkdir } from "node:fs/promises";

type Bucket1m = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  largestSize: number;
  largestSide: string;
};

async function aggregateMonth(year: number, month: number): Promise<Bucket1m[]> {
  const startMs = Date.UTC(year, month, 1);
  const endMs = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);

  console.log(`Loading ${year}-${month + 1}...`);
  const buckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: "BTCUSDT",
    startMs,
    endMs,
  });
  console.log(`  ${buckets.length} 1s buckets`);

  // Aggregate to 1-minute
  const byMinute = new Map<number, Bucket1m>();

  for (const b of buckets) {
    const minuteMs = Math.floor(b.bucketMs / 60_000) * 60_000;
    const existing = byMinute.get(minuteMs);

    if (!existing) {
      byMinute.set(minuteMs, {
        time: minuteMs,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        largestSize: b.largestTradeSize,
        largestSide: b.largestTradeSide,
      });
    } else {
      existing.high = Math.max(existing.high, b.high);
      existing.low = Math.min(existing.low, b.low);
      existing.close = b.close;
      if (b.largestTradeSize > existing.largestSize) {
        existing.largestSize = b.largestTradeSize;
        existing.largestSide = b.largestTradeSide;
      }
    }
  }

  return [...byMinute.values()].sort((a, b) => a.time - b.time);
}

async function main() {
  const all: Bucket1m[] = [];

  for (const [year, month] of [[2025, 4], [2025, 5]]) {
    const buckets = await aggregateMonth(year, month);
    all.push(...buckets);
    console.log(`  ${buckets.length} 1m buckets`);
  }

  await mkdir(".data", { recursive: true });
  const out = ".data/buckets-1m-may-jun-2025.json";
  await writeFile(out, JSON.stringify(all, null, 2));
  console.log(`\nSaved ${all.length} 1m buckets to ${out}`);
}

main().catch(console.error);
