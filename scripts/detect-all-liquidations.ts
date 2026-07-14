import { readOrderflowBuckets } from "../packages/market-data";
import { writeFile, mkdir } from "node:fs/promises";

type DetectedLiquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

async function detectMonth(year: number, month: number): Promise<DetectedLiquidation[]> {
  const label = `${year}-${String(month + 1).padStart(2, "0")}`;
  const startMs = Date.UTC(year, month, 1);
  const endMs = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);

  const buckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: "BTCUSDT",
    startMs,
    endMs,
  });

  const liquidations: DetectedLiquidation[] = [];
  let lastPrice = 0;

  for (const bucket of buckets) {
    const size = bucket.largestTradeSize;
    const side = bucket.largestTradeSide;
    const price = bucket.close;

    if (lastPrice > 0 && size > 0.1) {
      const priceChange = (price - lastPrice) / lastPrice;

      if (side === "sell" && priceChange < -0.001) {
        liquidations.push({ time: bucket.bucketMs, price, side: "long", size });
      } else if (side === "buy" && priceChange > 0.001) {
        liquidations.push({ time: bucket.bucketMs, price, side: "short", size });
      }
    }

    lastPrice = price;
  }

  const longs = liquidations.filter((l) => l.side === "long");
  const shorts = liquidations.filter((l) => l.side === "short");
  console.log(`${label}: ${liquidations.length} liquidations (${longs.length} long, ${shorts.length} short)`);

  return liquidations;
}

async function main() {
  const all: DetectedLiquidation[] = [];

  for (const [year, month] of [[2025, 4], [2025, 5], [2025, 6]]) {
    const liqs = await detectMonth(year, month);
    all.push(...liqs);
  }

  await mkdir(".data", { recursive: true });
  const out = ".data/detected-liquidations-may-jul-2025.json";
  await writeFile(out, JSON.stringify(all, null, 2));
  console.log(`\nTotal: ${all.length} liquidations saved to ${out}`);

  // Stats by day
  const byDay = new Map<string, number>();
  for (const l of all) {
    const day = new Date(l.time).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  console.log(`\nDays with liquidations: ${byDay.size}`);
  console.log(`Avg per day: ${(all.length / byDay.size).toFixed(1)}`);
}

main().catch(console.error);
