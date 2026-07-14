import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as arrow from "apache-arrow";
import { readParquet } from "parquet-wasm/node";

type DetectedLiquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

const SIZE_THRESHOLD = 0.3; // BTC

async function detectFromFile(path: string, startMs: number, endMs: number): Promise<DetectedLiquidation[]> {
  const bytes = await readFile(path);
  const wasmTable = readParquet(new Uint8Array(bytes), {
    columns: ["bucketMs", "close", "largestTradeSize", "largestTradeSide"],
  });

  try {
    const table = arrow.tableFromIPC(wasmTable.intoIPCStream());
    const bucketMs = table.getChild("bucketMs")!.toArray() as ArrayLike<bigint>;
    const close = table.getChild("close")!.toArray() as ArrayLike<number>;
    const size = table.getChild("largestTradeSize")!.toArray() as ArrayLike<number>;
    const side = table.getChild("largestTradeSide")!.toArray() as ArrayLike<number>;

    const liquidations: DetectedLiquidation[] = [];
    let lastPrice = 0;

    for (let i = 0; i < table.numRows; i++) {
      const t = Number(bucketMs[i]);
      if (t < startMs || t > endMs) {
        lastPrice = close[i];
        continue;
      }

      const s = size[i];
      if (s < SIZE_THRESHOLD) {
        lastPrice = close[i];
        continue;
      }

      const tradeSide = side[i] >= 0 ? "buy" : "sell";
      const price = close[i];

      // Simple heuristic: large sell during price drop = long liquidation
      // Large buy during price rise = short liquidation
      if (lastPrice > 0) {
        const priceChange = (price - lastPrice) / lastPrice;

        if (tradeSide === "sell" && priceChange < -0.0005) {
          liquidations.push({ time: t, price, side: "long", size: s });
        } else if (tradeSide === "buy" && priceChange > 0.0005) {
          liquidations.push({ time: t, price, side: "short", size: s });
        }
      }

      lastPrice = price;
    }

    return liquidations;
  } finally {
    try { wasmTable.free(); } catch {}
  }
}

async function main() {
  const months = ["2025-05", "2025-06", "2025-07"];
  const all: DetectedLiquidation[] = [];

  for (const m of months) {
    const [year, mon] = m.split("-").map(Number);
    const startMs = Date.UTC(year, mon - 1, 1);
    const endMs = Date.UTC(year, mon, 0, 23, 59, 59, 999);
    const path = `.data/market-store/bybit/trading/BTCUSDT/buckets-1s-${m}.parquet`;

    console.log(`${m}: detecting...`);
    const liqs = await detectFromFile(path, startMs, endMs);
    console.log(`  ${liqs.length} liquidations (${liqs.filter((l) => l.side === "long").length} long, ${liqs.filter((l) => l.side === "short").length} short)`);
    all.push(...liqs);
  }

  await mkdir(".data", { recursive: true });
  const out = ".data/detected-liquidations.json";
  await writeFile(out, JSON.stringify(all, null, 2));
  console.log(`\nTotal: ${all.length} liquidations saved to ${out}`);

  // Stats
  const longs = all.filter((l) => l.side === "long");
  const shorts = all.filter((l) => l.side === "short");
  console.log(`Long: ${longs.length}, Short: ${shorts.length}`);
  console.log(`Total size: ${all.reduce((s, l) => s + l.size, 0).toFixed(2)} BTC`);
  console.log(`Avg size: ${(all.reduce((s, l) => s + l.size, 0) / all.length).toFixed(3)} BTC`);
}

main().catch(console.error);
