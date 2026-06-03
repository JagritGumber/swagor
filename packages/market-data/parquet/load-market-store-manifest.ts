import { readFile } from "node:fs/promises";
import { marketStoreManifestPath } from "./market-store-paths";
import type { MarketStoreManifest, MarketStoreMarket, MarketStoreVenue } from "./types";

export async function loadMarketStoreManifest(input: {
  rootDir: string;
  venue: MarketStoreVenue;
  market: MarketStoreMarket;
  symbol: string;
}): Promise<MarketStoreManifest> {
  const path = marketStoreManifestPath(input);
  const text = await readFile(path, "utf8");
  const parsed = JSON.parse(text) as MarketStoreManifest;
  if (parsed.venue !== input.venue) throw new Error(`market store manifest venue mismatch at ${path}`);
  if (parsed.market !== input.market) throw new Error(`market store manifest market mismatch at ${path}`);
  if (parsed.symbol !== input.symbol.toUpperCase()) throw new Error(`market store manifest symbol mismatch at ${path}`);
  return parsed;
}
