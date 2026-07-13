import { readOrderflowBuckets, readVolumeProfileBuckets } from "../packages/market-data";
import { readMarketStructure } from "../packages/strategy-lab/reader/reader-structure/read-market-structure";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const start = arg("start", "2025-05-01");
const end = arg("end", "2025-05-07");
const startMs = Date.parse(`${start}T00:00:00Z`);
const endMs = Date.parse(`${end}T23:59:59Z`);

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  console.log(`Testing market structure reader ${start} to ${end}`);
  const overallStart = Date.now();

  const asset = "BTCUSDT";

  console.log("\nLoading data...");
  const dataStart = Date.now();

  const profileBuckets = await readVolumeProfileBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: asset,
    startMs,
    endMs,
  });
  console.log(`  Profile buckets: ${profileBuckets.length} (${((Date.now() - dataStart) / 1000).toFixed(1)}s)`);

  const orderflowStart = Date.now();
  const orderflowBuckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: asset,
    startMs,
    endMs,
  });
  console.log(`  Orderflow buckets: ${orderflowBuckets.length} (${((Date.now() - orderflowStart) / 1000).toFixed(1)}s)`);

  console.log(`\nData loaded in ${((Date.now() - dataStart) / 1000).toFixed(1)}s`);

  const lastBucket = orderflowBuckets[orderflowBuckets.length - 1];
  const lastPrice = lastBucket?.close ?? 0;

  console.log(`\nTesting at last price: ${lastPrice}`);

  const read = readMarketStructure({
    asset,
    timestampMs: lastBucket?.bucketMs ?? Date.now(),
    profileBuckets,
    orderflowBuckets: orderflowBuckets.slice(-300),
    price: lastPrice,
  });

  console.log(`\n=== MARKET STRUCTURE READ ===`);
  console.log(`Location: ${read.location}`);
  console.log(`Action: ${read.action}`);
  console.log(`Absorption: ${read.absorption}`);
  if (read.nearestNode) {
    console.log(`Nearest node: ${read.nearestNode.kind} at ${read.nearestNode.mid.toFixed(2)} (${read.nearestNode.low.toFixed(2)} - ${read.nearestNode.high.toFixed(2)})`);
  }
  if (read.cvd) {
    console.log(`CVD: ${read.cvd.cvd.toFixed(2)} (trend: ${read.cvd.cvdTrend}, divergence: ${read.cvd.priceCvdDivergence})`);
  }
  if (read.structure) {
    console.log(`Structure:`);
    console.log(`  POC: ${read.structure.poc.toFixed(2)}`);
    console.log(`  VAH: ${read.structure.valueAreaHigh.toFixed(2)}`);
    console.log(`  VAL: ${read.structure.valueAreaLow.toFixed(2)}`);
    console.log(`  HVN count: ${read.structure.hvn.length}`);
    console.log(`  LVN count: ${read.structure.lvn.length}`);
  }
  console.log(`\nNarrative: ${read.narrative}`);

  console.log(`\nTotal elapsed: ${((Date.now() - overallStart) / 1000).toFixed(1)}s`);
}
