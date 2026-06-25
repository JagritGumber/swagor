import { join } from "node:path";
import type { MarketStoreMarket, MarketStoreVenue } from "./types";

export function marketStoreSymbolDir(input: {
  rootDir: string;
  venue: MarketStoreVenue;
  market: MarketStoreMarket;
  symbol: string;
}): string {
  return join(input.rootDir, input.venue, input.market, input.symbol.toUpperCase());
}

export function marketStoreManifestPath(input: {
  rootDir: string;
  venue: MarketStoreVenue;
  market: MarketStoreMarket;
  symbol: string;
}): string {
  return join(marketStoreSymbolDir(input), "manifest.json");
}

export function marketStoreMonthFileName(kind: "buckets-1s" | "profiles-5m", month: string): string {
  return `${kind}-${month}.parquet`;
}

export function monthKeyFor(timeMs: number): string {
  return new Date(timeMs).toISOString().slice(0, 7);
}

