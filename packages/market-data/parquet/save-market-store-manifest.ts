import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { marketStoreManifestPath } from "./market-store-paths";
import type { MarketStoreManifest } from "./types";

export async function saveMarketStoreManifest(input: {
  rootDir: string;
  manifest: MarketStoreManifest;
}): Promise<void> {
  const path = marketStoreManifestPath({
    rootDir: input.rootDir,
    venue: input.manifest.venue,
    market: input.manifest.market,
    symbol: input.manifest.symbol,
  });
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${JSON.stringify(input.manifest, null, 2)}\n`, "utf8");
  await rename(tmp, path);
}

