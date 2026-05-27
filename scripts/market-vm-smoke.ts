import { ingestHyperliquidCandles, readVmCandles, type CandleInterval, type HyperliquidNetwork } from "../packages/market-data/src";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseNetwork(value: string | undefined): HyperliquidNetwork {
  return value === "testnet" ? "testnet" : "mainnet";
}

function parseInterval(value: string | undefined): CandleInterval {
  return value === "1h" ? "1h" : "5m";
}

async function main(): Promise<void> {
  const vmUrl = arg("vm-url", "http://localhost:8428")!;
  const network = parseNetwork(arg("network", "mainnet"));
  const asset = arg("asset", "BTC")!.toUpperCase();
  const interval = parseInterval(arg("interval", "5m"));
  const days = Number(arg("days", "1"));
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");

  const endMs = Date.now();
  const startMs = endMs - days * 86_400_000;
  await ingestHyperliquidCandles({ vmUrl, network, assets: [asset], intervals: [interval], startMs, endMs });
  const candles = await readVmCandles({ vmUrl, network, asset, interval, startMs, endMs });
  if (candles.length === 0) throw new Error("no candles read back from VictoriaMetrics");
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].t < candles[i - 1].t) throw new Error("candles are not sorted");
  }
  console.log(`[market:vm:smoke] ${network} ${asset} ${interval}: ${candles.length} candles read back`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
