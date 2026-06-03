import { join } from "node:path";
import { loadMarketStoreManifest } from "./load-market-store-manifest";
import { readVolumeProfileBucketsParquet } from "./read-volume-profile-buckets-parquet";
import type { MarketStoreMarket, MarketStoreVenue, VolumeProfileBucket } from "./types";

export async function readVolumeProfileBuckets(input: {
  rootDir: string;
  venue: MarketStoreVenue;
  market: MarketStoreMarket;
  symbol: string;
  startMs: number;
  endMs: number;
}): Promise<VolumeProfileBucket[]> {
  if (input.endMs < input.startMs) throw new Error("endMs must be on or after startMs");
  const manifest = await loadMarketStoreManifest(input);
  const rows: VolumeProfileBucket[] = [];
  for (const entry of Object.values(manifest.months)) {
    const file = entry.profiles5m;
    if (!file || file.endMs < input.startMs || file.startMs > input.endMs) continue;
    const path = join(input.rootDir, input.venue, input.market, input.symbol.toUpperCase(), file.path);
    const monthRows = await readVolumeProfileBucketsParquet({ path, startMs: input.startMs, endMs: input.endMs });
    for (const row of monthRows) rows.push(row);
  }
  return rows.sort((left, right) => left.startMs - right.startMs || left.binLow - right.binLow);
}
