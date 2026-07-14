import { readOrderflowBuckets } from "../packages/market-data";
import { readFile } from "node:fs/promises";

type Liquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

const STOP_DISTANCE = 0.002;
const TARGET_DISTANCE = 0.004;
const TIMEOUT_MS = 3_600_000;

async function main() {
  const detected = JSON.parse(await readFile(".data/detected-liquidations.json", "utf8")) as Liquidation[];
  console.log(`${detected.length} liquidations`);

  let wins = 0, losses = 0, timeouts = 0;
  let totalR = 0;
  const rValues: number[] = [];

  for (const liq of detected) {
    // Load only 2 hours around each liquidation
    const windowStart = liq.time - 60_000;
    const windowEnd = liq.time + TIMEOUT_MS + 60_000;

    const buckets = await readOrderflowBuckets({
      rootDir: ".data/market-store",
      venue: "bybit",
      market: "trading",
      symbol: "BTCUSDT",
      startMs: windowStart,
      endMs: windowEnd,
    });

    const entryTime = liq.time + 30_000;
    const entryBucket = buckets.find((b) => b.bucketMs >= entryTime);
    if (!entryBucket) continue;

    const isLong = liq.side === "long";
    const entryPrice = entryBucket.close;
    const stop = isLong ? entryPrice * (1 - STOP_DISTANCE) : entryPrice * (1 + STOP_DISTANCE);
    const target = isLong ? entryPrice * (1 + TARGET_DISTANCE) : entryPrice * (1 - TARGET_DISTANCE);

    const futureBuckets = buckets.filter((b) => b.bucketMs > entryTime);
    let exitR = 0;
    let reason = "timeout";

    for (const b of futureBuckets) {
      if (isLong) {
        if (b.low <= stop) { exitR = -1; reason = "stop"; break; }
        if (b.high >= target) { exitR = 2; reason = "target"; break; }
      } else {
        if (b.high >= stop) { exitR = -1; reason = "stop"; break; }
        if (b.low <= target) { exitR = 2; reason = "target"; break; }
      }
      if (b.bucketMs - entryTime > TIMEOUT_MS) {
        exitR = isLong ? (b.close - entryPrice) / (entryPrice - stop) : (entryPrice - b.close) / (stop - entryPrice);
        reason = "timeout";
        break;
      }
    }

    rValues.push(exitR);
    totalR += exitR;
    if (exitR > 0) wins++;
    else if (exitR < 0) losses++;
    else timeouts++;
  }

  const total = rValues.length;
  console.log(`\n=== RESULTS ===`);
  console.log(`Trades: ${total}`);
  console.log(`Win: ${wins} (${(wins / total * 100).toFixed(1)}%)`);
  console.log(`Loss: ${losses}`);
  console.log(`Timeout: ${timeouts}`);
  console.log(`Total R: ${totalR > 0 ? "+" : ""}${totalR.toFixed(2)}R`);
  console.log(`Avg R: ${(totalR / total).toFixed(4)}R`);
  console.log(`R/trade: ${(totalR / total).toFixed(4)}`);

  // Max DD
  let eq = 0, peak = 0, dd = 0;
  for (const r of rValues) {
    eq += r;
    if (eq > peak) peak = eq;
    if (eq - peak < dd) dd = eq - peak;
  }
  console.log(`Max DD: ${dd.toFixed(2)}R`);
}

main().catch(console.error);
