import { readOrderflowBuckets } from "../packages/market-data";
import { readFile } from "node:fs/promises";

type Liquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

type Trade = {
  r: number;
  side: string;
  exitReason: string;
};

const STOP_DISTANCE = 0.002;
const TARGET_DISTANCE = 0.004;
const TIMEOUT_MS = 3_600_000;

async function main() {
  const detected = JSON.parse(await readFile(".data/detected-liquidations.json", "utf8")) as Liquidation[];
  console.log(`${detected.length} liquidations loaded`);

  // Load all price data once
  const startMs = Date.UTC(2025, 4, 1);
  const endMs = Date.UTC(2025, 6, 0, 23, 59, 59, 999);
  console.log("Loading price data...");
  const allBuckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: "BTCUSDT",
    startMs,
    endMs,
  });
  console.log(`${allBuckets.length} buckets loaded`);

  // Index buckets by time for fast lookup
  const bucketMap = new Map(allBuckets.map((b) => [b.bucketMs, b]));

  const trades: Trade[] = [];
  let skipped = 0;

  for (const liq of detected) {
    const entryTime = liq.time + 30_000;

    // Find nearest bucket
    let entryBucket = bucketMap.get(entryTime);
    if (!entryBucket) {
      // Find next bucket
      const nextTime = allBuckets.find((b) => b.bucketMs >= entryTime)?.bucketMs;
      if (!nextTime) { skipped++; continue; }
      entryBucket = bucketMap.get(nextTime);
      if (!entryBucket) { skipped++; continue; }
    }

    const side = liq.side === "long" ? "long" : "short";
    const entryPrice = entryBucket.close;
    const isLong = side === "long";
    const stop = isLong ? entryPrice * (1 - STOP_DISTANCE) : entryPrice * (1 + STOP_DISTANCE);
    const target = isLong ? entryPrice * (1 + TARGET_DISTANCE) : entryPrice * (1 - TARGET_DISTANCE);

    // Find exit from future buckets
    const futureBuckets = allBuckets.filter((b) => b.bucketMs > entryTime).slice(0, 100);
    let exitR = 0;
    let exitReason = "timeout";

    for (const b of futureBuckets) {
      if (isLong) {
        if (b.low <= stop) { exitR = -1; exitReason = "stop"; break; }
        if (b.high >= target) { exitR = 2; exitReason = "target"; break; }
      } else {
        if (b.high >= stop) { exitR = -1; exitReason = "stop"; break; }
        if (b.low <= target) { exitR = 2; exitReason = "target"; break; }
      }
      if (b.bucketMs - entryTime > TIMEOUT_MS) {
        exitR = isLong ? (b.close - entryPrice) / (entryPrice - stop) : (entryPrice - b.close) / (stop - entryPrice);
        exitReason = "timeout";
        break;
      }
    }

    trades.push({ r: exitR, side, exitReason });
  }

  console.log(`\n${trades.length} trades, ${skipped} skipped`);

  const wins = trades.filter((t) => t.r > 0).length;
  const totalR = trades.reduce((s, t) => s + t.r, 0);
  const avgR = totalR / trades.length;

  console.log(`Win rate: ${(wins / trades.length * 100).toFixed(1)}%`);
  console.log(`Total R: ${totalR > 0 ? "+" : ""}${totalR.toFixed(2)}R`);
  console.log(`Avg R: ${avgR.toFixed(4)}R`);

  // By reason
  const byReason = new Map<string, { count: number; r: number }>();
  for (const t of trades) {
    const e = byReason.get(t.exitReason) ?? { count: 0, r: 0 };
    e.count++;
    e.r += t.r;
    byReason.set(t.exitReason, e);
  }
  for (const [reason, stats] of byReason) {
    console.log(`  ${reason}: ${stats.count}, ${(stats.r / stats.count).toFixed(4)} avg R`);
  }

  // Max DD
  let eq = 0, peak = 0, dd = 0;
  for (const t of trades) {
    eq += t.r;
    if (eq > peak) peak = eq;
    if (eq - peak < dd) dd = eq - peak;
  }
  console.log(`Max DD: ${dd.toFixed(2)}R`);
}

main().catch(console.error);
