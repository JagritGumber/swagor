import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as arrow from "apache-arrow";
import { readParquet } from "parquet-wasm/node";

type DetectedLiquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

async function detectFromFile(path: string): Promise<DetectedLiquidation[]> {
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
    let lastIdx = -1;

    for (let i = 0; i < table.numRows; i++) {
      const t = Number(bucketMs[i]);
      const s = size[i];
      const tradeSide = side[i] >= 0 ? "buy" : "sell";
      const price = close[i];

      // Need previous price
      if (lastIdx >= 0 && s > 0.1) {
        const priceChange = (price - lastPrice) / lastPrice;

        // Large sell during drop = long liquidation
        if (tradeSide === "sell" && priceChange < -0.001) {
          liquidations.push({ time: t, price, side: "long", size: s });
        }
        // Large buy during rise = short liquidation
        else if (tradeSide === "buy" && priceChange > 0.001) {
          liquidations.push({ time: t, price, side: "short", size: s });
        }
      }

      lastPrice = price;
      lastIdx = i;
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
    const path = `.data/market-store/bybit/trading/BTCUSDT/buckets-5m-${m}.parquet`;
    console.log(`${m}: detecting...`);
    const liqs = await detectFromFile(path);
    console.log(`  ${liqs.length} liquidations`);
    all.push(...liqs);
  }

  await mkdir(".data", { recursive: true });
  const out = ".data/detected-liquidations-5m.json";
  await writeFile(out, JSON.stringify(all, null, 2));
  console.log(`\nTotal: ${all.length} saved to ${out}`);

  const longs = all.filter((l) => l.side === "long");
  const shorts = all.filter((l) => l.side === "short");
  console.log(`Long: ${longs.length}, Short: ${shorts.length}`);
}

main().catch(console.error);
