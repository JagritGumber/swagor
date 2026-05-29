import { ingestHyperliquidCandles, type CandleInterval, type HyperliquidNetwork } from "../packages/market-data";

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
  const startArg = arg("start");
  const endArg = arg("end");

  const endMs = endArg ? Date.parse(endArg) : Date.now();
  const startMs = startArg ? Date.parse(startArg) : endMs - days * 86_400_000;
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");
  if (!Number.isFinite(startMs)) throw new Error("--start must be an ISO timestamp when provided");
  if (!Number.isFinite(endMs)) throw new Error("--end must be an ISO timestamp when provided");
  if (endMs < startMs) throw new Error("--end must be after --start");

  const results = await ingestHyperliquidCandles({ vmUrl, network, assets, intervals, startMs, endMs });
  for (const result of results) {
    console.log(`[market:ingest] ${network} ${result.asset} ${result.interval}: ${result.candles} candles`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
