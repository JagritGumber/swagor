import { readFile } from "node:fs/promises";
import * as arrow from "apache-arrow";
import { readParquet } from "parquet-wasm/node";
import type { VolumeProfileBucket } from "./types";

const VOLUME_PROFILE_COLUMNS = ["startMs", "endMs", "binLow", "binHigh", "binMid", "volume"];

export async function readVolumeProfileBucketsParquet(input: {
  path: string;
  startMs?: number;
  endMs?: number;
}): Promise<VolumeProfileBucket[]> {
  const bytes = await readFile(input.path);
  const wasmTable = readParquet(new Uint8Array(bytes), { columns: VOLUME_PROFILE_COLUMNS });
  try {
    const table = arrow.tableFromIPC(wasmTable.intoIPCStream());
    const rows: VolumeProfileBucket[] = [];
    const startMs = bigints(table, "startMs");
    const endMs = bigints(table, "endMs");
    const binLow = numbers(table, "binLow");
    const binHigh = numbers(table, "binHigh");
    const binMid = numbers(table, "binMid");
    const volume = numbers(table, "volume");
    for (let index = 0; index < table.numRows; index += 1) {
      const start = Number(startMs[index]);
      const end = Number(endMs[index]);
      if (input.startMs !== undefined && end < input.startMs) continue;
      if (input.endMs !== undefined && start > input.endMs) continue;
      rows.push({
        startMs: start,
        endMs: end,
        binLow: binLow[index]!,
        binHigh: binHigh[index]!,
        binMid: binMid[index]!,
        volume: volume[index]!,
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

