import { readFile } from "node:fs/promises";
import * as arrow from "apache-arrow";
import { readParquet } from "parquet-wasm/node";

async function main() {
  const bytes = await readFile(".data/market-store/bybit/trading/BTCUSDT/profiles-5m-2025-05.parquet");
  const wasmTable = readParquet(new Uint8Array(bytes));

  try {
    const table = arrow.tableFromIPC(wasmTable.intoIPCStream());
    console.log("Columns:", table.schema.fields.map((f) => f.name));
    console.log("Rows:", table.numRows);

    // Show first row
    const cols = table.schema.fields.map((f) => f.name);
    const first: any = {};
    for (const col of cols) {
      const child = table.getChild(col);
      if (child) {
        first[col] = child.get(0);
      }
    }
    console.log("\nFirst row:");
    console.log(JSON.stringify(first, null, 2));
  } finally {
    try { wasmTable.free(); } catch {}
  }
}

main().catch(console.error);
