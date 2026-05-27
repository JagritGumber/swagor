import { readVmCandles, type CandleInterval, type HyperliquidNetwork } from "../packages/market-data/src";
import { runBacktest, starterStrategies } from "../packages/strategy-lab/src";

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
  const assets = arg("assets", "BTC,ETH,SOL")!.split(",").map((asset) => asset.trim().toUpperCase()).filter(Boolean);
  const interval = parseInterval(arg("interval", "5m"));
  const days = Number(arg("days", "30"));
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");

  const endMs = Date.now();
  const startMs = endMs - days * 86_400_000;
  for (const asset of assets) {
    const candles = await readVmCandles({ vmUrl, network, asset, interval, startMs, endMs });
    console.log(JSON.stringify({ asset, interval, candles: candles.length, first: iso(candles[0]?.t), last: iso(candles.at(-1)?.t) }));
    for (const strategy of starterStrategies) {
      const result = runBacktest({
        strategy,
        symbol: asset,
        candles,
        costs: {
          feeBps: 4.5,
          slippageBps: 2,
        },
      });
      console.log(JSON.stringify({
        asset,
        interval,
        strategy: result.strategyId,
        trades: result.trades.length,
        totalPnlPct: Number(result.totalPnlPct.toFixed(3)),
        winRate: Number((result.winRate * 100).toFixed(1)),
        maxDrawdownPct: Number(result.maxDrawdownPct.toFixed(3)),
      }));
    }
  }
}

function iso(value: number | undefined): string | null {
  return value === undefined ? null : new Date(value).toISOString();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
