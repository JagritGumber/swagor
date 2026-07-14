import { readFile } from "node:fs/promises";
import * as arrow from "apache-arrow";
import { readParquet } from "parquet-wasm/node";

async function main() {
  const bytes = await readFile(".data/market-store/bybit/trading/BTCUSDT/buckets-1s-2025-05.parquet");
  console.log(`File size: ${(bytes.length / 1024 / 1024).toFixed(1)} MB`);

  // Try reading with minimal columns and small limit
  const start = Date.now();
  const wasmTable = readParquet(new Uint8Array(bytes), {
    columns: ["bucketMs", "close", "largestTradeSize", "largestTradeSide"],
    rowLimit: 1000,
  });
  const table = arrow.tableFromIPC(wasmTable.intoIPCStream());
  console.log(`Read ${table.numRows} rows in ${Date.now() - start}ms`);

  // Get some stats
  const sizes = table.getChild("largestTradeSize")!.toArray() as ArrayLike<number>;
  let largeTrades = 0;
  let maxTrade = 0;
  for (let i = 0; i < table.numRows; i++) {
    const s = sizes[i];
    if (s > maxTrade) maxTrade = s;
    if (s > 0.1) largeTrades++;
  }

  console.log(`Large trades (>0.1 BTC): ${largeTrades}`);
  console.log(`Max trade size: ${maxTrade.toFixed(3)} BTC`);

  try { wasmTable.free(); } catch {}
}

main().catch(console.error);
