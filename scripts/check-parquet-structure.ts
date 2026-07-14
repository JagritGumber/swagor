import { parquetRead } from "hyparquet";
import { readFile } from "node:fs/promises";

async function main() {
  const file = ".data/market-store/bybit/trading/BTCUSDT/buckets-1s-2025-05.parquet";
  const buffer = await readFile(file);

  await parquetRead({
    file: buffer,
    onComplete: (data) => {
      console.log(`Rows: ${data.length}`);
      console.log("Columns:", data[0] ? Object.keys(data[0]) : "empty");
      if (data.length > 0) {
        console.log("\nFirst row:");
        console.log(JSON.stringify(data[0], null, 2));
        console.log("\nSecond row:");
        console.log(JSON.stringify(data[1], null, 2));
      }
    },
  });
}

main().catch(console.error);
