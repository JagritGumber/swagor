import { readVmCandles, type CandleInterval, type HyperliquidNetwork } from "../packages/market-data/src";
import { readMarketAuction } from "../packages/strategy-lab/src";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseNetwork(value: string | undefined): HyperliquidNetwork {
  return value === "testnet" ? "testnet" : "mainnet";
}

function parseInterval(value: string | undefined): CandleInterval {
  return value === "5m" ? "5m" : "1h";
}

async function main(): Promise<void> {
  const vmUrl = arg("vm-url", "http://localhost:8428")!;
  const network = parseNetwork(arg("network", "mainnet"));
  const assets = arg("assets", "BTC,ETH,SOL")!.split(",").map((asset) => asset.trim().toUpperCase()).filter(Boolean);
  const interval = parseInterval(arg("interval", "1h"));
  const days = Number(arg("days", interval === "1h" ? "180" : "30"));
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");

  const endMs = Date.now();
  const startMs = endMs - days * 86_400_000;
  for (const asset of assets) {
    const candles = await readVmCandles({ vmUrl, network, asset, interval, startMs, endMs });
    const read = readMarketAuction({ asset, interval, candles });
    console.log(JSON.stringify(formatRead(read, candles.length)));
  }
}

function formatRead(read: ReturnType<typeof readMarketAuction>, candles: number): object {
  return {
    asset: read.asset,
    interval: read.interval,
    candles,
    bias: read.bias,
    location: read.location,
    level: read.level ? {
      kind: read.level.kind,
      price: round(read.level.price),
      touches: read.level.touches,
    } : null,
    profile: read.profile ? {
      poc: round(read.profile.poc),
      valueAreaLow: round(read.profile.valueAreaLow),
      valueAreaHigh: round(read.profile.valueAreaHigh),
    } : null,
    narrative: read.narrative,
    invalidation: read.invalidation,
    target: read.target,
  };
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
