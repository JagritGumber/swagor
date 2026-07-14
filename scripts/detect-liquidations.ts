import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as arrow from "apache-arrow";
import { readParquet } from "parquet-wasm/node";

type DetectedLiquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
  confidence: number;
  reason: string;
};

const LIQUIDATION_SIZE_THRESHOLD = 0.5; // BTC - large trades likely liquidations
const PRICE_MOVE_THRESHOLD = 0.001; // 0.1% price move in liquidation direction
const REVERSAL_WINDOW_MS = 5000; // 5 seconds to check for reversal

async function readBuckets(path: string, startMs?: number, endMs?: number): Promise<any[]> {
  const bytes = await readFile(path);
  const columns = [
    "bucketMs", "open", "high", "low", "close",
    "buyVolume", "sellVolume", "delta", "tradeCount",
    "largestTradeSize", "largestTradePrice", "largestTradeSide",
  ];

  const wasmTable = readParquet(new Uint8Array(bytes), { columns });
  try {
    const table = arrow.tableFromIPC(wasmTable.intoIPCStream());
    const rows: any[] = [];
    const bucketMs = table.getChild("bucketMs")!.toArray() as ArrayLike<bigint>;
    const largestTradeSize = table.getChild("largestTradeSize")!.toArray() as ArrayLike<number>;
    const largestTradeSide = table.getChild("largestTradeSide")!.toArray() as ArrayLike<number>;
    const close = table.getChild("close")!.toArray() as ArrayLike<number>;

    for (let i = 0; i < table.numRows; i++) {
      const time = Number(bucketMs[i]);
      if (startMs !== undefined && time < startMs) continue;
      if (endMs !== undefined && time > endMs) continue;

      rows.push({
        time,
        close: close[i],
        largestTradeSize: largestTradeSize[i],
        largestTradeSide: largestTradeSide[i] >= 0 ? "buy" : "sell",
      });
    }
    return rows;
  } finally {
    try { wasmTable.free(); } catch {}
  }
}

function detectLiquidations(buckets: any[]): DetectedLiquidation[] {
  const liquidations: DetectedLiquidation[] = [];

  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i];
    const size = bucket.largestTradeSize;
    const side = bucket.largestTradeSide;

    if (size < LIQUIDATION_SIZE_THRESHOLD) continue;

    // Check if this could be a liquidation
    // Long liquidation: large SELL during price drop
    // Short liquidation: large BUY during price rise

    // Look at price action before and after
    const lookback = Math.max(0, i - 10);
    const lookahead = Math.min(buckets.length - 1, i + 10);

    const priceBefore = buckets[lookback].close;
    const priceAfter = buckets[lookahead].close;
    const currentPrice = bucket.close;

    let confidence = 0;
    let reason = "";

    if (side === "sell") {
      // Potential long liquidation - large sell
      const dropBefore = (priceBefore - currentPrice) / priceBefore;
      const dropAfter = (currentPrice - priceAfter) / currentPrice;

      if (dropBefore > PRICE_MOVE_THRESHOLD) {
        confidence += 0.4;
        reason += "price-dropping;";
      }
      if (dropAfter > 0) {
        confidence += 0.3;
        reason += "continues-drop;";
      }
      if (size > 1) {
        confidence += 0.3;
        reason += "very-large;";
      }

      if (confidence >= 0.5) {
        liquidations.push({
          time: bucket.time,
          price: currentPrice,
          side: "long",
          size,
          confidence,
          reason,
        });
      }
    } else {
      // Potential short liquidation - large buy
      const riseBefore = (currentPrice - priceBefore) / priceBefore;
      const riseAfter = (priceAfter - currentPrice) / currentPrice;

      if (riseBefore > PRICE_MOVE_THRESHOLD) {
        confidence += 0.4;
        reason += "price-rising;";
      }
      if (riseAfter > 0) {
        confidence += 0.3;
        reason += "continues-rise;";
      }
      if (size > 1) {
        confidence += 0.3;
        reason += "very-large;";
      }

      if (confidence >= 0.5) {
        liquidations.push({
          time: bucket.time,
          price: currentPrice,
          side: "short",
          size,
          confidence,
          reason,
        });
      }
    }
  }

  return liquidations;
}

async function main() {
  const months = [
    { year: 2025, month: 4, label: "2025-05" },
    { year: 2025, month: 5, label: "2025-06" },
    { year: 2025, month: 6, label: "2025-07" },
  ];

  const allLiquidations: DetectedLiquidation[] = [];

  for (const m of months) {
    const startMs = Date.UTC(m.year, m.month, 1);
    const endMs = Date.UTC(m.year, m.month + 1, 0, 23, 59, 59, 999);
    const path = `.data/market-store/bybit/trading/BTCUSDT/buckets-1s-${m.label}.parquet`;

    console.log(`Processing ${m.label}...`);
    const buckets = await readBuckets(path, startMs, endMs);
    console.log(`  Loaded ${buckets.length} buckets`);

    const liquidations = detectLiquidations(buckets);
    console.log(`  Detected ${liquidations.length} potential liquidations`);

    allLiquidations.push(...liquidations);

    // Print some stats
    const longs = liquidations.filter((l) => l.side === "long");
    const shorts = liquidations.filter((l) => l.side === "short");
    console.log(`  Long: ${longs.length}, Short: ${shorts.length}`);

    if (liquidations.length > 0) {
      const avgSize = liquidations.reduce((s, l) => s + l.size, 0) / liquidations.length;
      const avgConf = liquidations.reduce((s, l) => s + l.confidence, 0) / liquidations.length;
      console.log(`  Avg size: ${avgSize.toFixed(3)} BTC, Avg confidence: ${avgConf.toFixed(2)}`);
    }
  }

  // Save all detected liquidations
  await mkdir(".data", { recursive: true });
  const filename = ".data/detected-liquidations-2025-05-2025-07.json";
  await writeFile(filename, JSON.stringify(allLiquidations, null, 2));
  console.log(`\nSaved ${allLiquidations.length} liquidations to ${filename}`);

  // Summary
  const longs = allLiquidations.filter((l) => l.side === "long");
  const shorts = allLiquidations.filter((l) => l.side === "short");
  console.log(`\n=== Summary ===`);
  console.log(`Total: ${allLiquidations.length}`);
  console.log(`Long liquidations: ${longs.length}`);
  console.log(`Short liquidations: ${shorts.length}`);
  console.log(`Total size: ${allLiquidations.reduce((s, l) => s + l.size, 0).toFixed(3)} BTC`);
}

main().catch(console.error);
