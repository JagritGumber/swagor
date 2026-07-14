import { readOrderflowBuckets } from "../packages/market-data";
import { writeFile, mkdir } from "node:fs/promises";

type DetectedLiquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

async function detectMonth(year: number, month: number): Promise<DetectedLiquidation[]> {
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

  return liquidations;
}

async function main() {
  // Just May and June
  const may = await detectMonth(2025, 4);
  console.log(`May: ${may.length}`);

  const jun = await detectMonth(2025, 5);
  console.log(`Jun: ${jun.length}`);

  const all = [...may, ...jun];

  await mkdir(".data", { recursive: true });
  const out = ".data/detected-liquidations.json";
  await writeFile(out, JSON.stringify(all, null, 2));
  console.log(`\nTotal: ${all.length} saved to ${out}`);
}

main().catch(console.error);
