import { readOrderflowBuckets } from "../packages/market-data";
import { writeFile, mkdir } from "node:fs/promises";

type DetectedLiquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

async function detectLiquidationsInRange(startMs: number, endMs: number): Promise<DetectedLiquidation[]> {
  const buckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: "BTCUSDT",
    startMs,
    endMs,
  });

  console.log(`  Loaded ${buckets.length} buckets`);

  const liquidations: DetectedLiquidation[] = [];
  let lastPrice = 0;

  for (const bucket of buckets) {
    const size = bucket.largestTradeSize;
    const side = bucket.largestTradeSide;
    const price = bucket.close;

    if (lastPrice > 0 && size > 0.1) {
      const priceChange = (price - lastPrice) / lastPrice;

      // Large sell during drop = long liquidation
      if (side === "sell" && priceChange < -0.001) {
        liquidations.push({ time: bucket.bucketMs, price, side: "long", size });
      }
      // Large buy during rise = short liquidation
      else if (side === "buy" && priceChange > 0.001) {
        liquidations.push({ time: bucket.bucketMs, price, side: "short", size });
      }
    }

    lastPrice = price;
  }

  return liquidations;
}

async function main() {
  // Test on 1 day first
  const startMs = Date.UTC(2025, 4, 15);
  const endMs = Date.UTC(2025, 4, 15, 23, 59, 59, 999);

  console.log("May 15, 2025:");
  const start = Date.now();
  const liqs = await detectLiquidationsInRange(startMs, endMs);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  Detected ${liqs.length} liquidations in ${elapsed}s`);

  if (liqs.length > 0) {
    console.log(`\n  Sample:`);
    for (const l of liqs.slice(0, 10)) {
      const time = new Date(l.time).toISOString().slice(11, 19);
      console.log(`    ${time} ${l.side} ${l.size.toFixed(3)} BTC @ $${l.price.toFixed(2)}`);
    }

    const longs = liqs.filter((l) => l.side === "long");
    const shorts = liqs.filter((l) => l.side === "short");
    console.log(`\n  Long: ${longs.length}, Short: ${shorts.length}`);
    console.log(`  Total size: ${liqs.reduce((s, l) => s + l.size, 0).toFixed(3)} BTC`);
  }
}

main().catch(console.error);
