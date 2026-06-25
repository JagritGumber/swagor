import { connectHyperliquidOrderflow, createOrderflowNdjsonWriter, type HyperliquidNetwork, type StoredOrderflowEvent } from "../packages/market-data";
import type { OrderflowEvent } from "../packages/strategy-lab";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseAssets(value: string | undefined): string[] {
  return (value ?? "BTC,ETH,SOL").split(",").map((asset) => asset.trim().toUpperCase()).filter(Boolean);
}

function parseNetwork(value: string | undefined): HyperliquidNetwork {
  return value === "testnet" ? "testnet" : "mainnet";
}

const assets = parseAssets(arg("assets", process.env.ASSETS));
const network = parseNetwork(arg("network", process.env.NETWORK ?? "mainnet"));
const rootDir = arg("root", process.env.ORDERFLOW_ROOT_DIR ?? "orderflow-data")!;
const minutes = Number(arg("minutes", process.env.MINUTES ?? "360"));
const flushIntervalMs = Number(arg("flush-ms", "1000"));

if (assets.length === 0) throw new Error("--assets must include at least one asset");
if (!Number.isFinite(minutes) || minutes <= 0) throw new Error("--minutes must be a positive number");
if (!Number.isFinite(flushIntervalMs) || flushIntervalMs <= 0) throw new Error("--flush-ms must be a positive number");

const writer = createOrderflowNdjsonWriter({
  rootDir,
  network,
  flushIntervalMs,
  onError: (error) => console.error("[record:orderflow] writer error", error),
});

const startedAt = Date.now();
const stats = new Map<string, AssetStats>();
for (const asset of assets) stats.set(asset, emptyStats());

let totalRecords = 0;
let totalEvents = 0;
let closed = false;

const connection = connectHyperliquidOrderflow({
  network,
  assets,
  onRecord(record) {
    writer.append(record);
    totalRecords += 1;
    updateRecordStats(record);
  },
  onEvent(event) {
    totalEvents += 1;
    updateEventStats(event);
  },
  onStatus(status) {
    console.log(`[record:orderflow] websocket ${status}`);
  },
  onError(error) {
    console.error("[record:orderflow] error", error);
  },
});

console.log(`[record:orderflow] network=${network} assets=${assets.join(",")} root=${rootDir} minutes=${minutes}`);

const statsTimer = setInterval(() => printStats(), 10_000);
const stopTimer = setTimeout(() => {
  void shutdown("timer elapsed");
}, minutes * 60_000);

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

type AssetStats = {
  records: number;
  trades: number;
  bbo: number;
  events: number;
  lastTradePrice: number | null;
  lastTradeAt: number | null;
};

function emptyStats(): AssetStats {
  return {
    records: 0,
    trades: 0,
    bbo: 0,
    events: 0,
    lastTradePrice: null,
    lastTradeAt: null,
  };
}

function updateRecordStats(record: StoredOrderflowEvent): void {
  const assetStats = statsFor(record.asset);
  assetStats.records += 1;
  if (record.channel === "trades") assetStats.trades += 1;
  if (record.channel === "bbo") assetStats.bbo += 1;
  assetStats.events += record.events.length;
}

function updateEventStats(event: OrderflowEvent): void {
  if (event.type !== "trade") return;
  const assetStats = statsFor(event.trade.asset);
  assetStats.lastTradePrice = event.trade.price;
  assetStats.lastTradeAt = event.trade.time;
}

function statsFor(asset: string): AssetStats {
  const key = asset.toUpperCase();
  const existing = stats.get(key);
  if (existing) return existing;
  const created = emptyStats();
  stats.set(key, created);
  return created;
}

function printStats(): void {
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  console.log(`[record:orderflow] runtime=${elapsedSeconds}s records=${totalRecords} events=${totalEvents}`);
  for (const [asset, assetStats] of stats) {
    console.log(`  ${asset} records=${assetStats.records} trades=${assetStats.trades} bbo=${assetStats.bbo} last=${assetStats.lastTradePrice ?? "n/a"} lastAt=${assetStats.lastTradeAt ? iso(assetStats.lastTradeAt) : "n/a"}`);
  }
}

async function shutdown(reason: string): Promise<void> {
  if (closed) return;
  closed = true;
  clearInterval(statsTimer);
  clearTimeout(stopTimer);
  console.log(`[record:orderflow] stopping: ${reason}`);
  connection.close();
  await writer.close();
  printStats();
  console.log("[record:orderflow] flushed and closed");
  process.exit(0);
}

function iso(time: number): string {
  return new Date(time).toISOString();
}

