import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import * as arrow from "apache-arrow";
import { Compression, Table, WriterPropertiesBuilder, writeParquet } from "parquet-wasm/node";
import type { OrderflowBucket } from "./types";

export async function writeOrderflowBucketsParquet(input: {
  path: string;
  rows: OrderflowBucket[];
}): Promise<void> {
  await mkdir(dirname(input.path), { recursive: true });
  const table = arrow.tableFromArrays({
    bucketMs: BigInt64Array.from(input.rows.map((row) => BigInt(row.bucketMs))),
    open: Float64Array.from(input.rows.map((row) => row.open)),
    high: Float64Array.from(input.rows.map((row) => row.high)),
    low: Float64Array.from(input.rows.map((row) => row.low)),
    close: Float64Array.from(input.rows.map((row) => row.close)),
    buyVolume: Float64Array.from(input.rows.map((row) => row.buyVolume)),
    sellVolume: Float64Array.from(input.rows.map((row) => row.sellVolume)),
    delta: Float64Array.from(input.rows.map((row) => row.delta)),
    tradeCount: Int32Array.from(input.rows.map((row) => row.tradeCount)),
    largestTradeSize: Float64Array.from(input.rows.map((row) => row.largestTradeSize)),
    largestTradePrice: Float64Array.from(input.rows.map((row) => row.largestTradePrice)),
    largestTradeSide: Int8Array.from(input.rows.map((row) => row.largestTradeSide === "buy" ? 1 : -1)),
    lastTradePrice: Float64Array.from(input.rows.map((row) => row.lastTradePrice)),
  });
  const wasmTable = Table.fromIPCStream(arrow.tableToIPC(table, "stream"));
  const properties = new WriterPropertiesBuilder()
    .setCompression(Compression.ZSTD)
    .setMaxRowGroupSize(100_000)
    .build();
  try {
    const bytes = writeParquet(wasmTable, properties);
    const tmp = `${input.path}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, input.path);
  } finally {
    freeWasm(wasmTable);
    freeWasm(properties);
  }
}

function freeWasm(value: { free(): void }): void {
  try {
    value.free();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("null pointer")) throw error;
  }
}
