import { join } from "node:path";
import { readOrderflowEvents, type HyperliquidNetwork } from "../packages/market-data";
import { createOrderflowWindow, readOrderflowWindow, updateOrderflowWindow } from "../packages/strategy-lab";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseNetwork(value: string | undefined): HyperliquidNetwork {
  return value === "testnet" ? "testnet" : "mainnet";
}

async function main(): Promise<void> {
  const network = parseNetwork(arg("network", "mainnet"));
  const asset = arg("asset", "BTC")!.toUpperCase();
  const date = arg("date", new Date().toISOString().slice(0, 10))!;
  const rootDir = arg("root-dir", "orderflow-data")!;
  const windowMs = Number(arg("window-seconds", "60")) * 1000;
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error("--window-seconds must be a positive number");

  const path = join(rootDir, "hyperliquid", network, asset, `${date}.ndjson`);
  const events = await readOrderflowEvents(path);
  const window = createOrderflowWindow(windowMs);
  for (const event of events) {
    updateOrderflowWindow(window, event);
  }
  console.log(JSON.stringify(readOrderflowWindow({ asset, window })));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
