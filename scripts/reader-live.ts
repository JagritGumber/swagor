import {
  appendOrderflowEvent,
  connectHyperliquidOrderflow,
  readVmCandles,
  type CandleInterval,
  type HyperliquidNetwork,
} from "../packages/market-data";
import {
  combineAuctionOrderflow,
  createOrderflowWindow,
  readMarketAuction,
  readOrderflowWindow,
  updateOrderflowWindow,
  type AuctionRead,
  type OrderflowWindow,
} from "../packages/strategy-lab";

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
  const asset = arg("asset", "BTC")!.toUpperCase();
  const intervalName = parseInterval(arg("interval", "1h"));
  const days = Number(arg("days", intervalName === "1h" ? "180" : "30"));
  const seconds = Number(arg("seconds", "60"));
  const rootDir = arg("root-dir", "orderflow-data")!;
  if (!Number.isFinite(days) || days <= 0) throw new Error("--days must be a positive number");
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("--seconds must be a positive number");

  const auction = await loadAuctionRead({ vmUrl, network, asset, interval: intervalName, days });
  const window = createOrderflowWindow(60_000);

  const interval = setInterval(() => {
    const orderflow = readOrderflowWindow({ asset, window });
    const read = combineAuctionOrderflow({ auction, orderflow });
    console.log(JSON.stringify(formatRead(read)));
  }, 1000);

  const connection = connectHyperliquidOrderflow({
    network,
    assets: [asset],
    onStatus: (status) => console.error(`[reader:live] ${status}`),
    onError: (error) => console.error("[reader:live] websocket error", error),
    onRecord: async (record) => {
      await appendOrderflowEvent({ rootDir, network, record });
    },
    onEvent: (event) => updateOrderflowWindow(window, event),
  });

  await sleep(seconds * 1000);
  clearInterval(interval);
  connection.close();
}

async function loadAuctionRead(input: {
  vmUrl: string;
  network: HyperliquidNetwork;
  asset: string;
  interval: CandleInterval;
  days: number;
}): Promise<AuctionRead> {
  const endMs = Date.now();
  const startMs = endMs - input.days * 86_400_000;
  const candles = await readVmCandles({
    vmUrl: input.vmUrl,
    network: input.network,
    asset: input.asset,
    interval: input.interval,
    startMs,
    endMs,
  });
  return readMarketAuction({ asset: input.asset, interval: input.interval, candles });
}

function formatRead(read: ReturnType<typeof combineAuctionOrderflow>): object {
  return {
    asset: read.asset,
    stance: read.stance,
    auction: {
      level: read.auction.level ? {
        kind: read.auction.level.kind,
        price: round(read.auction.level.price),
        touches: read.auction.level.touches,
      } : null,
      location: read.auction.location,
      bias: read.auction.bias,
      profile: read.auction.profile ? {
        poc: round(read.auction.profile.poc),
        valueAreaLow: round(read.auction.profile.valueAreaLow),
        valueAreaHigh: round(read.auction.profile.valueAreaHigh),
      } : null,
    },
    orderflow: {
      lastPrice: read.orderflow.lastPrice,
      pressure: read.orderflow.pressure,
      delta: round(read.orderflow.delta),
      tradeCount: read.orderflow.tradeCount,
      events: read.orderflow.events,
    },
    narrative: read.narrative,
    invalidation: read.invalidation,
    target: read.target,
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
