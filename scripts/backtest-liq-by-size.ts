import { readFile } from "node:fs/promises";

type Bucket1m = {
  time: number;
  high: number;
  low: number;
  close: number;
};

type Liquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

const STOP = 0.002;
const TARGET = 0.004;

async function testSize(minSize: number, direction: "fade" | "with") {
  const detected = JSON.parse(await readFile(".data/detected-liquidations.json", "utf8")) as Liquidation[];
  const buckets = JSON.parse(await readFile(".data/buckets-1m-may-jun-2025.json", "utf8")) as Bucket1m[];

  const filtered = detected.filter((l) => l.size >= minSize);
  let wins = 0, total = 0, totalR = 0;

  for (const liq of filtered) {
    const entryIdx = buckets.findIndex((b) => b.time >= liq.time + 60_000);
    if (entryIdx < 0) continue;

    const isLong = direction === "fade" ? liq.side === "long" : liq.side === "short";
    const entry = buckets[entryIdx].close;
    const stop = isLong ? entry * (1 - STOP) : entry * (1 + STOP);
    const target = isLong ? entry * (1 + TARGET) : entry * (1 - TARGET);

    let r = 0;
    for (let i = entryIdx + 1; i < entryIdx + 60 && i < buckets.length; i++) {
      const b = buckets[i];
      if (isLong) {
        if (b.low <= stop) { r = -1; break; }
        if (b.high >= target) { r = 2; break; }
      } else {
        if (b.high >= stop) { r = -1; break; }
        if (b.low <= target) { r = 2; break; }
      }
      if (i === entryIdx + 59) r = isLong ? (b.close - entry) / (entry - stop) : (entry - b.close) / (stop - entry);
    }

    totalR += r;
    total++;
    if (r > 0) wins++;
  }

  if (total === 0) return;
  console.log(`${direction} >=${minSize}BTC: ${total} trades, ${(wins/total*100).toFixed(1)}% win, ${(totalR/total).toFixed(4)} R/trade, ${totalR.toFixed(2)}R total`);
}

async function main() {
  console.log("=== FADE (trade against liquidation) ===");
  for (const min of [0.1, 0.5, 1, 2, 5]) await testSize(min, "fade");

  console.log("\n=== WITH (trade with liquidation) ===");
  for (const min of [0.1, 0.5, 1, 2, 5]) await testSize(min, "with");
}

main().catch(console.error);
