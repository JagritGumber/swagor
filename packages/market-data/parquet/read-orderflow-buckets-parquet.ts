import { readFile } from "node:fs/promises";
import * as arrow from "apache-arrow";
import { readParquet } from "parquet-wasm/node";
import type { OrderflowBucket } from "./types";

const ORDERFLOW_BUCKET_COLUMNS = [
  "bucketMs",
  "open",
  "high",
  "low",
  "close",
  "buyVolume",
  "sellVolume",
  "delta",
  "tradeCount",
  "largestTradeSize",
  "largestTradePrice",
  "largestTradeSide",
  "lastTradePrice",
];

export async function readOrderflowBucketsParquet(input: {
  path: string;
  startMs?: number;
  endMs?: number;
  offset?: number;
  limit?: number;
}): Promise<OrderflowBucket[]> {
  const bytes = await readFile(input.path);
  const wasmTable = readParquet(new Uint8Array(bytes), {
    columns: ORDERFLOW_BUCKET_COLUMNS,
    ...(input.offset === undefined ? {} : { offset: input.offset }),
    ...(input.limit === undefined ? {} : { limit: input.limit }),
  });
  try {
    const table = arrow.tableFromIPC(wasmTable.intoIPCStream());
    const rows: OrderflowBucket[] = [];
    const bucketMs = bigints(table, "bucketMs");
    const open = numbers(table, "open");
    const high = numbers(table, "high");
    const low = numbers(table, "low");
    const close = numbers(table, "close");
    const buyVolume = numbers(table, "buyVolume");
    const sellVolume = numbers(table, "sellVolume");
    const delta = numbers(table, "delta");
    const tradeCount = numbers(table, "tradeCount");
    const largestTradeSize = numbers(table, "largestTradeSize");
    const largestTradePrice = numbers(table, "largestTradePrice");
    const largestTradeSide = numbers(table, "largestTradeSide");
    const lastTradePrice = numbers(table, "lastTradePrice");

    for (let index = 0; index < table.numRows; index += 1) {
      const time = Number(bucketMs[index]);
      if (input.startMs !== undefined && time < input.startMs) continue;
      if (input.endMs !== undefined && time > input.endMs) continue;
      rows.push({
        bucketMs: time,
        open: open[index]!,
        high: high[index]!,
        low: low[index]!,
        close: close[index]!,
        buyVolume: buyVolume[index]!,
        sellVolume: sellVolume[index]!,
        delta: delta[index]!,
        tradeCount: tradeCount[index]!,
        largestTradeSize: largestTradeSize[index]!,
        largestTradePrice: largestTradePrice[index]!,
        largestTradeSide: largestTradeSide[index]! >= 0 ? "buy" : "sell",
        lastTradePrice: lastTradePrice[index]!,
      });
    }
    return rows;
  } finally {
    freeWasm(wasmTable);
  }
}

function numbers(table: arrow.Table, name: string): ArrayLike<number> {
  const column = table.getChild(name);
  if (!column) throw new Error(`Parquet file is missing ${name}`);
  return column.toArray() as ArrayLike<number>;
}

function bigints(table: arrow.Table, name: string): ArrayLike<bigint> {
  const column = table.getChild(name);
  if (!column) throw new Error(`Parquet file is missing ${name}`);
  return column.toArray() as ArrayLike<bigint>;
}

function freeWasm(value: { free(): void }): void {
  try {
    value.free();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("null pointer")) throw error;
  }
}
