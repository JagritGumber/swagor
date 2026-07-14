import { readFile, writeFile, mkdir } from "node:fs/promises";
import * as arrow from "apache-arrow";
import { readParquet } from "parquet-wasm/node";

type DetectedLiquidation = {
  time: number;
  price: number;
  side: "long" | "short";
  size: number;
};

async function detectFromFile(path: string, maxRows?: number): Promise<DetectedLiquidation[]> {
  const bytes = await readFile(path);
  const opts: any = {
    columns: ["bucketMs", "close", "largestTradeSize", "largestTradeSide"],
  };
  if (maxRows) opts.rowLimit = maxRows;

  const wasmTable = readParquet(new Uint8Array(bytes), opts);

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
      const s = size[i];
      const tradeSide = side[i] >= 0 ? "buy" : "sell";
      const price = close[i];

      if (lastPrice > 0 && s > 0.1) {
        const priceChange = (price - lastPrice) / lastPrice;

        if (tradeSide === "sell" && priceChange < -0.001) {
          liquidations.push({ time: t, price, side: "long", size: s });
        } else if (tradeSide === "buy" && priceChange > 0.001) {
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
  const path = ".data/market-store/bybit/trading/BTCUSDT/buckets-1s-2025-05.parquet";

  // Just scan first 100k rows to see if it works
  console.log("Scanning first 100k rows...");
  const start = Date.now();
  const liqs = await detectFromFile(path, 100_000);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s`);
  console.log(`Found ${liqs.length} potential liquidations`);

  if (liqs.length > 0) {
    console.log(`\nSample (first 5):`);
    for (const l of liqs.slice(0, 5)) {
      const time = new Date(l.time).toISOString();
      console.log(`  ${time} ${l.side} ${l.size.toFixed(3)} BTC @ $${l.price.toFixed(2)}`);
    }

    const longs = liqs.filter((l) => l.side === "long");
    const shorts = liqs.filter((l) => l.side === "short");
    console.log(`\nLong: ${longs.length}, Short: ${shorts.length}`);
    console.log(`Avg size: ${(liqs.reduce((s, l) => s + l.size, 0) / liqs.length).toFixed(3)} BTC`);
  }
}

main().catch(console.error);
