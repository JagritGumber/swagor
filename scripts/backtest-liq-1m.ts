import { readFile } from "node:fs/promises";

type Bucket1m = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  largestSize: number;
  largestSide: string;
};

type Liquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

const STOP_DISTANCE = 0.002;
const TARGET_DISTANCE = 0.004;
const TIMEOUT_BARS = 60; // 60 minutes

async function main() {
  const detected = JSON.parse(await readFile(".data/detected-liquidations.json", "utf8")) as Liquidation[];
  const buckets = JSON.parse(await readFile(".data/buckets-1m-may-jun-2025.json", "utf8")) as Bucket1m[];

  console.log(`${detected.length} liquidations, ${buckets.length} 1m buckets`);

  let wins = 0, losses = 0, timeouts = 0;
  let totalR = 0;
  const rValues: number[] = [];

  for (const liq of detected) {
    const entryTime = liq.time + 60_000; // 1 minute after
    const entryIdx = buckets.findIndex((b) => b.time >= entryTime);
    if (entryIdx < 0) continue;

    const isLong = liq.side === "long";
    const entryPrice = buckets[entryIdx].close;
    const stop = isLong ? entryPrice * (1 - STOP_DISTANCE) : entryPrice * (1 + STOP_DISTANCE);
    const target = isLong ? entryPrice * (1 + TARGET_DISTANCE) : entryPrice * (1 - TARGET_DISTANCE);

    let exitR = 0;
    let reason = "timeout";

    for (let i = entryIdx + 1; i < Math.min(entryIdx + TIMEOUT_BARS, buckets.length); i++) {
      const b = buckets[i];
      if (isLong) {
        if (b.low <= stop) { exitR = -1; reason = "stop"; break; }
        if (b.high >= target) { exitR = 2; reason = "target"; break; }
      } else {
        if (b.high >= stop) { exitR = -1; reason = "stop"; break; }
        if (b.low <= target) { exitR = 2; reason = "target"; break; }
      }
      if (i === entryIdx + TIMEOUT_BARS - 1) {
        exitR = isLong ? (b.close - entryPrice) / (entryPrice - stop) : (entryPrice - b.close) / (stop - entryPrice);
        reason = "timeout";
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

  let eq = 0, peak = 0, dd = 0;
  for (const r of rValues) {
    eq += r;
    if (eq > peak) peak = eq;
    if (eq - peak < dd) dd = eq - peak;
  }
  console.log(`Max DD: ${dd.toFixed(2)}R`);

  // Compare to baseline
  console.log(`\nBaseline (no filter): 0.09 R/trade`);
  console.log(`This: ${(totalR / total).toFixed(4)} R/trade`);
}

main().catch(console.error);
