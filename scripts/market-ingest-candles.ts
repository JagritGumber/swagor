import { ingestHyperliquidCandles, type CandleInterval, type HyperliquidNetwork } from "../packages/market-data/src";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseNetwork(value: string | undefined): HyperliquidNetwork {
  if (value === "testnet") return "testnet";
  return "mainnet";
}

function parseIntervals(value: string | undefined): CandleInterval[] {
  return (value ?? "5m,1h").split(",").map((item) => item.trim()).filter((item): item is CandleInterval => item === "5m" || item === "1h");
}

async function main(): Promise<void> {
  const vmUrl = arg("vm-url", "http://localhost:8428")!;
  const network = parseNetwork(arg("network", "mainnet"));
  const assets = arg("assets", "BTC,ETH,SOL")!.split(",").map((asset) => asset.trim().toUpperCase()).filter(Boolean);
  const intervals = parseIntervals(arg("intervals", "5m,1h"));
  const days = Number(arg("days", "180"));
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");

  const endMs = Date.now();
  const startMs = endMs - days * 86_400_000;
  const results = await ingestHyperliquidCandles({ vmUrl, network, assets, intervals, startMs, endMs });
  for (const result of results) {
    console.log(`[market:ingest] ${network} ${result.asset} ${result.interval}: ${result.candles} candles`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
