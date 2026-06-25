import { join } from "node:path";
import type { HyperliquidNetwork } from "../shared/types";

export function orderflowFilePath(input: {
  rootDir: string;
  network: HyperliquidNetwork;
  asset: string;
  time: number;
}): string {
  const asset = input.asset.toUpperCase();
  const date = new Date(input.time).toISOString().slice(0, 10);
  return join(input.rootDir, "hyperliquid", input.network, asset, `${date}.ndjson`);
}

