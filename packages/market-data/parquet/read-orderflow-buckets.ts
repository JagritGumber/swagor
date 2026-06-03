import { join } from "node:path";
import { loadMarketStoreManifest } from "./load-market-store-manifest";
import { readOrderflowBucketsParquet } from "./read-orderflow-buckets-parquet";
import type { MarketStoreMarket, MarketStoreVenue, OrderflowBucket } from "./types";

export async function readOrderflowBuckets(input: {
  rootDir: string;
  venue: MarketStoreVenue;
  market: MarketStoreMarket;
  symbol: string;
  startMs: number;
  endMs: number;
}): Promise<OrderflowBucket[]> {
  if (input.endMs < input.startMs) throw new Error("endMs must be on or after startMs");
  const manifest = await loadMarketStoreManifest(input);
  const rows: OrderflowBucket[] = [];
  for (const entry of Object.values(manifest.months)) {
    const file = entry.buckets1s;
    if (!file || file.endMs < input.startMs || file.startMs > input.endMs) continue;
    const path = join(input.rootDir, input.venue, input.market, input.symbol.toUpperCase(), file.path);
    const window = parquetRowWindow({
      fileStartMs: file.startMs,
      fileEndMs: file.endMs,
      rowCount: file.rowCount,
      startMs: input.startMs,
      endMs: input.endMs,
    });
    const monthRows = await readOrderflowBucketsParquet({
      path,
      startMs: input.startMs,
      endMs: input.endMs,
      ...window,
    });
    for (const row of monthRows) rows.push(row);
  }
  return rows.sort((left, right) => left.bucketMs - right.bucketMs);
}

function parquetRowWindow(input: {
  fileStartMs: number;
  fileEndMs: number;
  rowCount: number;
  startMs: number;
  endMs: number;
}): { offset?: number; limit?: number } {
  if (input.rowCount <= 0) return {};
  const readStart = Math.max(input.fileStartMs, input.startMs);
  const readEnd = Math.min(input.fileEndMs, input.endMs);
  const fileDuration = input.fileEndMs - input.fileStartMs;
  if (fileDuration <= 0) return {};

  const startFraction = Math.max(0, Math.min(1, (readStart - input.fileStartMs) / fileDuration));
  const endFraction = Math.max(0, Math.min(1, (readEnd - input.fileStartMs) / fileDuration));
  const estimatedStart = Math.floor(startFraction * input.rowCount);
  const estimatedEnd = Math.ceil(endFraction * input.rowCount);
  const padding = Math.max(50_000, Math.ceil(input.rowCount * 0.05));
  const offset = Math.max(0, estimatedStart - padding);
  const endOffset = Math.min(input.rowCount, estimatedEnd + padding);
  if (offset === 0 && endOffset >= input.rowCount) return {};
  return {
    offset,
    limit: Math.max(0, endOffset - offset),
  };
}
