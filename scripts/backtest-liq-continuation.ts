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
const TIMEOUT_BARS = 60;

async function main() {
  const detected = JSON.parse(await readFile(".data/detected-liquidations.json", "utf8")) as Liquidation[];
  const buckets = JSON.parse(await readFile(".data/buckets-1m-may-jun-2025.json", "utf8")) as Bucket1m[];

  console.log(`${detected.length} liquidations`);

  // Strategy: trade WITH the liquidation (continuation)
  // If long liquidated (sell), go SHORT (price continues down)
  // If short liquidated (buy), go LONG (price continues up)

  let wins = 0, losses = 0;
  let totalR = 0;
  const rValues: number[] = [];

  for (const liq of detected) {
    const entryTime = liq.time + 60_000;
    const entryIdx = buckets.findIndex((b) => b.time >= entryTime);
    if (entryIdx < 0) continue;

    // Trade WITH liquidation
    const isShort = liq.side === "long"; // Long liquidated = go short
    const entryPrice = buckets[entryIdx].close;
    const stop = isShort ? entryPrice * (1 + STOP_DISTANCE) : entryPrice * (1 - STOP_DISTANCE);
    const target = isShort ? entryPrice * (1 - TARGET_DISTANCE) : entryPrice * (1 + TARGET_DISTANCE);

    let exitR = 0;

    for (let i = entryIdx + 1; i < Math.min(entryIdx + TIMEOUT_BARS, buckets.length); i++) {
      const b = buckets[i];
      if (isShort) {
        if (b.high >= stop) { exitR = -1; break; }
        if (b.low <= target) { exitR = 2; break; }
      } else {
        if (b.low <= stop) { exitR = -1; break; }
        if (b.high >= target) { exitR = 2; break; }
      }
      if (i === entryIdx + TIMEOUT_BARS - 1) {
        exitR = isShort ? (entryPrice - b.close) / (stop - entryPrice) : (b.close - entryPrice) / (entryPrice - stop);
      }
    }

    rValues.push(exitR);
    totalR += exitR;
    if (exitR > 0) wins++;
    else losses++;
  }

  const total = rValues.length;
  console.log(`\n=== CONTINUATION (trade with liquidation) ===`);
  console.log(`Trades: ${total}`);
  console.log(`Win: ${wins} (${(wins / total * 100).toFixed(1)}%)`);
  console.log(`Total R: ${totalR > 0 ? "+" : ""}${totalR.toFixed(2)}R`);
  console.log(`Avg R: ${(totalR / total).toFixed(4)}R`);

  let eq = 0, peak = 0, dd = 0;
  for (const r of rValues) {
    eq += r;
    if (eq > peak) peak = eq;
    if (eq - peak < dd) dd = eq - peak;
  }
  console.log(`Max DD: ${dd.toFixed(2)}R`);
}

main().catch(console.error);
