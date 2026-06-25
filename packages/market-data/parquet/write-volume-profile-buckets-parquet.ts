import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import * as arrow from "apache-arrow";
import { Compression, Table, WriterPropertiesBuilder, writeParquet } from "parquet-wasm/node";
import type { VolumeProfileBucket } from "./types";

export async function writeVolumeProfileBucketsParquet(input: {
  path: string;
  rows: VolumeProfileBucket[];
}): Promise<void> {
  await mkdir(dirname(input.path), { recursive: true });
  const table = arrow.tableFromArrays({
    startMs: BigInt64Array.from(input.rows.map((row) => BigInt(row.startMs))),
    endMs: BigInt64Array.from(input.rows.map((row) => BigInt(row.endMs))),
    binLow: Float64Array.from(input.rows.map((row) => row.binLow)),
    binHigh: Float64Array.from(input.rows.map((row) => row.binHigh)),
    binMid: Float64Array.from(input.rows.map((row) => row.binMid)),
    volume: Float64Array.from(input.rows.map((row) => row.volume)),
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

