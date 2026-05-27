import { appendOrderflowEvent, connectHyperliquidOrderflow, type HyperliquidNetwork } from "../packages/market-data";
import { createOrderflowWindow, readOrderflowWindow, updateOrderflowWindow, type OrderflowWindow } from "../packages/strategy-lab";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseNetwork(value: string | undefined): HyperliquidNetwork {
  return value === "testnet" ? "testnet" : "mainnet";
}

async function main(): Promise<void> {
  const network = parseNetwork(arg("network", "mainnet"));
  const assets = arg("assets", "BTC")!.split(",").map((asset) => asset.trim().toUpperCase()).filter(Boolean);
  const seconds = Number(arg("seconds", "60"));
  const rootDir = arg("root-dir", "orderflow-data")!;
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("--seconds must be a positive number");

  const windows = new Map<string, OrderflowWindow>();
  for (const asset of assets) windows.set(asset, createOrderflowWindow(60_000));

  const interval = setInterval(() => {
    for (const asset of assets) {
      const window = windows.get(asset);
      if (!window) continue;
      const read = readOrderflowWindow({ asset, window });
      console.log(JSON.stringify(formatRead(read)));
    }
  }, 1000);

  const connection = connectHyperliquidOrderflow({
    network,
    assets,
    onStatus: (status) => console.error(`[orderflow] ${status}`),
    onError: (error) => console.error("[orderflow] websocket error", error),
    onRecord: async (record) => {
      await appendOrderflowEvent({ rootDir, network, record });
    },
    onEvent: (event) => {
      const asset = event.type === "trade" ? event.trade.asset : event.bbo.asset;
      const window = windows.get(asset);
      if (window) updateOrderflowWindow(window, event);
    },
  });

  await sleep(seconds * 1000);
  clearInterval(interval);
  connection.close();
}

function formatRead(read: ReturnType<typeof readOrderflowWindow>): object {
  return {
    asset: read.asset,
    windowSeconds: read.windowSeconds,
    lastPrice: read.lastPrice,
    buyVolume: round(read.buyVolume),
    sellVolume: round(read.sellVolume),
    delta: round(read.delta),
    tradeCount: read.tradeCount,
    averageTradeSize: round(read.averageTradeSize),
    largestTrade: read.largestTrade ? {
      side: read.largestTrade.side,
      price: read.largestTrade.price,
      size: read.largestTrade.size,
    } : null,
    dominantSide: read.dominantSide,
    pressure: read.pressure,
    events: read.events,
    narrative: read.narrative,
  };
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
