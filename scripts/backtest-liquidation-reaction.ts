import { readOrderflowBuckets } from "../packages/market-data";
import { readFile } from "node:fs/promises";

type Liquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

type Trade = {
  entryTime: number;
  entryPrice: number;
  side: "long" | "short";
  stop: number;
  target: number;
  exitTime: number;
  exitPrice: number;
  exitReason: string;
  r: number;
  liqPrice: number;
  liqSize: number;
};

const ENTRY_DELAY_MS = 30_000; // Wait 30s after liquidation for cascade to finish
const STOP_DISTANCE = 0.002; // 0.2% stop from entry
const TARGET_DISTANCE = 0.004; // 0.4% target (2:1 R:R)

async function main() {
  const detected = JSON.parse(await readFile(".data/detected-liquidations.json", "utf8")) as Liquidation[];
  console.log(`Loaded ${detected.length} detected liquidations`);

  // Get price data for May-June
  const startMs = Date.UTC(2025, 4, 1);
  const endMs = Date.UTC(2025, 6, 0, 23, 59, 59, 999);

  const buckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: "BTCUSDT",
    startMs,
    endMs,
  });

  console.log(`Loaded ${buckets.length} price buckets`);

  const trades: Trade[] = [];

  for (const liq of detected) {
    // Find the entry point (30s after liquidation)
    const entryTime = liq.time + ENTRY_DELAY_MS;
    const entryBucket = buckets.find((b) => b.bucketMs >= entryTime);
    if (!entryBucket) continue;

    // Fade the liquidation: if long was liquidated (sell), we go long (price should bounce)
    // If short was liquidated (buy), we go short (price should drop)
    const side = liq.side === "long" ? "long" : "short";
    const entryPrice = entryBucket.close;

    if (side === "long") {
      const stop = entryPrice * (1 - STOP_DISTANCE);
      const target = entryPrice * (1 + TARGET_DISTANCE);

      // Find exit
      const futureBuckets = buckets.filter((b) => b.bucketMs > entryTime);
      let exitPrice = entryPrice;
      let exitTime = entryTime;
      let exitReason = "timeout";

      for (const b of futureBuckets) {
        if (b.low <= stop) {
          exitPrice = stop;
          exitTime = b.bucketMs;
          exitReason = "stop";
          break;
        }
        if (b.high >= target) {
          exitPrice = target;
          exitTime = b.bucketMs;
          exitReason = "target";
          break;
        }
        // Timeout after 1 hour
        if (b.bucketMs - entryTime > 3_600_000) {
          exitPrice = b.close;
          exitTime = b.bucketMs;
          exitReason = "timeout";
          break;
        }
      }

      const r = (exitPrice - entryPrice) / (entryPrice - stop);
      trades.push({
        entryTime,
        entryPrice,
        side,
        stop,
        target,
        exitTime,
        exitPrice,
        exitReason,
        r,
        liqPrice: liq.price,
        liqSize: liq.size,
      });
    } else {
      const stop = entryPrice * (1 + STOP_DISTANCE);
      const target = entryPrice * (1 - TARGET_DISTANCE);

      const futureBuckets = buckets.filter((b) => b.bucketMs > entryTime);
      let exitPrice = entryPrice;
      let exitTime = entryTime;
      let exitReason = "timeout";

      for (const b of futureBuckets) {
        if (b.high >= stop) {
          exitPrice = stop;
          exitTime = b.bucketMs;
          exitReason = "stop";
          break;
        }
        if (b.low <= target) {
          exitPrice = target;
          exitTime = b.bucketMs;
          exitReason = "target";
          break;
        }
        if (b.bucketMs - entryTime > 3_600_000) {
          exitPrice = b.close;
          exitTime = b.bucketMs;
          exitReason = "timeout";
          break;
        }
      }

      const r = (entryPrice - exitPrice) / (stop - entryPrice);
      trades.push({
        entryTime,
        entryPrice,
        side,
        stop,
        target,
        exitTime,
        exitPrice,
        exitReason,
        r,
        liqPrice: liq.price,
        liqSize: liq.size,
      });
    }
  }

  // Results
  console.log(`\n=== RESULTS ===`);
  console.log(`Total trades: ${trades.length}`);

  const wins = trades.filter((t) => t.r > 0);
  const losses = trades.filter((t) => t.r < 0);
  console.log(`Wins: ${wins.length} (${(wins.length / trades.length * 100).toFixed(1)}%)`);
  console.log(`Losses: ${losses.length} (${(losses.length / trades.length * 100).toFixed(1)}%)`);

  const totalR = trades.reduce((s, t) => s + t.r, 0);
  const avgR = totalR / trades.length;
  console.log(`Total R: ${totalR > 0 ? "+" : ""}${totalR.toFixed(2)}R`);
  console.log(`Avg R: ${avgR.toFixed(4)}R`);

  // By exit reason
  const byReason = new Map<string, { count: number; totalR: number }>();
  for (const t of trades) {
    const existing = byReason.get(t.exitReason) ?? { count: 0, totalR: 0 };
    existing.count++;
    existing.totalR += t.r;
    byReason.set(t.exitReason, existing);
  }
  console.log(`\nBy exit reason:`);
  for (const [reason, stats] of byReason) {
    console.log(`  ${reason}: ${stats.count} trades, ${stats.totalR > 0 ? "+" : ""}${stats.totalR.toFixed(2)}R`);
  }

  // By side
  const longs = trades.filter((t) => t.side === "long");
  const shorts = trades.filter((t) => t.side === "short");
  console.log(`\nLong trades: ${longs.length}, avg R: ${(longs.reduce((s, t) => s + t.r, 0) / longs.length).toFixed(4)}`);
  console.log(`Short trades: ${shorts.length}, avg R: ${(shorts.reduce((s, t) => s + t.r, 0) / shorts.length).toFixed(4)}`);

  // Max drawdown
  let equity = 0;
  let peak = 0;
  let maxDD = 0;
  for (const t of trades) {
    equity += t.r;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDD) maxDD = dd;
  }
  console.log(`\nMax drawdown: ${maxDD.toFixed(2)}R`);

  // R/trade
  console.log(`\nR/trade: ${avgR.toFixed(4)}`);
  console.log(`Benchmark comparison: baseline 0.09, this ${avgR.toFixed(4)}`);
}

main().catch(console.error);
