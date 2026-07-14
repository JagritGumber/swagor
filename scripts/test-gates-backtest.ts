import { readOrderflowBuckets, intervalMs } from "../packages/market-data";
import { runReaderReplay } from "../packages/strategy-lab/reader/reader-replay/run-reader-replay";
import { buildReaderHistoryReads } from "../packages/strategy-lab/reader/reader-history/build-reader-history-reads";
import { buildOrLoadHistorySteps } from "../packages/strategy-lab/reader/reader-history/history-cache";
import type { ReaderTradePlanConfig } from "../packages/strategy-lab/backtest/trade-plan/types";
import type { OrderflowEvent } from "../packages/strategy-lab/read-core/orderflow/types";
import type { Candle } from "../packages/strategy-lab/types";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const start = arg("start", "2025-05-01");
const end = arg("end", "2025-05-07");
const startMs = Date.parse(`${start}T00:00:00Z`);
const endMs = Date.parse(`${end}T23:59:59Z`);
const noCache = process.argv.includes("--no-cache");

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  console.log(`Running reader replay ${start} to ${end}`);
  const overallStart = Date.now();

  // Shared: read data once
  const dataStart = Date.now();
  const asset = "BTCUSDT";
  const buckets = await readOrderflowBuckets({
    rootDir: ".data/market-store",
    venue: "bybit",
    market: "trading",
    symbol: asset,
    startMs,
    endMs,
  });
  const candleIntervalMs = intervalMs("5m");
  const candles = candlesFromBuckets({ buckets, intervalMs: candleIntervalMs });
  const orderflowEvents = orderflowEventsFromBuckets({ asset, buckets });
  console.log(`Data loaded in ${((Date.now() - dataStart) / 1000).toFixed(1)}s (${buckets.length} buckets, ${candles.length} candles, ${orderflowEvents.length} events)`);

  // Build or load history from cache
  const historyStart = Date.now();
  const { steps: historySteps, fromCache } = buildOrLoadHistorySteps(
    {
      asset,
      interval: "5m",
      candleIntervalMs,
      candles,
      orderflowEvents,
      readIntervalMs: 5000,
      orderflowWindowMs: 60_000,
      startAt: startMs,
      endAt: endMs,
    },
    (input) => buildReaderHistoryReads(input),
    { skipCache: noCache },
  );
  console.log(`History ${fromCache ? "loaded from cache" : "built and cached"} in ${((Date.now() - historyStart) / 1000).toFixed(1)}s (${historySteps.length} steps)`);

  // Run without gates (baseline)
  console.log("\n=== BASELINE (no gates) ===");
  const baselineStart = Date.now();
  const baseline = runReaderReplay({
    reads: historySteps,
    requireTimestamps: true,
    setupConfig: {},
    skipResultSnapshots: true,
  });
  console.log(`Baseline replay: ${((Date.now() - baselineStart) / 1000).toFixed(1)}s`);
  printResult("baseline", baseline);

  // Run with gates (regime + trade count)
  console.log("\n=== WITH GATES (trend-down + trade count 500-1000) ===");
  const gatedStart = Date.now();
  const gated = runReaderReplay({
    reads: historySteps,
    requireTimestamps: true,
    setupConfig: {
      tradePlanConfig: {
        allowedRegimes: ["trend-down"],
        minTradeCount: 500,
        maxTradeCount: 1000,
      } as ReaderTradePlanConfig,
    },
    skipResultSnapshots: true,
  });
  console.log(`Gated replay: ${((Date.now() - gatedStart) / 1000).toFixed(1)}s`);
  printResult("gated", gated);

  // Compare
  console.log("\n=== COMPARISON ===");
  const bEntries = baseline.summary.totalEntries;
  const gEntries = gated.summary.totalEntries;
  const bWins = baseline.summary.winRate;
  const gWins = gated.summary.winRate;
  const bR = baseline.summary.totalR;
  const gR = gated.summary.totalR;
  console.log(`Entries: ${bEntries} -> ${gEntries} (${bEntries > 0 ? ((gEntries / bEntries) * 100).toFixed(1) : 0}% of baseline)`);
  console.log(`Win rate: ${(bWins * 100).toFixed(1)}% -> ${(gWins * 100).toFixed(1)}%`);
  console.log(`Total R: ${bR.toFixed(4)} -> ${gR.toFixed(4)}`);
  console.log(`Avg R: ${baseline.summary.averageR.toFixed(4)} -> ${gated.summary.averageR.toFixed(4)}`);
  console.log(`Max DD: ${baseline.summary.maxDrawdownR.toFixed(4)} -> ${gated.summary.maxDrawdownR.toFixed(4)}`);
  console.log(`\nTotal elapsed: ${((Date.now() - overallStart) / 1000).toFixed(1)}s`);
}

function printResult(label: string, result: ReturnType<typeof runReaderReplay>): void {
  const s = result.summary;
  console.log(`${label}: ${s.totalEntries} entries, ${s.entriesOpened} opened, WR ${(s.winRate * 100).toFixed(1)}%, Total R ${s.totalR.toFixed(4)}, Avg R ${s.averageR.toFixed(4)}, Max DD ${s.maxDrawdownR.toFixed(4)}`);
  console.log(`  Setup events: ${result.setupEvents.length}, Plans: ${result.setupResults.length}`);
  const blocked = result.setupResults.filter((r) => r.plan.status === "no-trade").length;
  const ready = result.setupResults.filter((r) => r.plan.status === "ready" || r.plan.status === "ready-if-reclaim").length;
  console.log(`  Plans: ${ready} ready, ${blocked} blocked`);
}

function candlesFromBuckets(input: { buckets: Array<{ bucketMs: number; open: number; high: number; low: number; close: number; buyVolume: number; sellVolume: number }>; intervalMs: number }): Candle[] {
  const candles: Candle[] = [];
  let current: Candle | null = null;
  let currentStart = 0;

  for (const bucket of input.buckets) {
    const start = Math.floor(bucket.bucketMs / input.intervalMs) * input.intervalMs;
    if (!current || start !== currentStart) {
      if (current) candles.push(current);
      currentStart = start;
      current = {
        t: start,
        o: bucket.open,
        h: bucket.high,
        l: bucket.low,
        c: bucket.close,
        v: bucket.buyVolume + bucket.sellVolume,
      };
      continue;
    }

    current.h = Math.max(current.h, bucket.high);
    current.l = Math.min(current.l, bucket.low);
    current.c = bucket.close;
    current.v += bucket.buyVolume + bucket.sellVolume;
  }

  if (current) candles.push(current);
  return candles;
}

function orderflowEventsFromBuckets(input: { asset: string; buckets: Array<{ bucketMs: number; close: number; largestTradeSide: "buy" | "sell"; largestTradeSize: number; largestTradePrice: number; buyVolume: number; sellVolume: number }> }): OrderflowEvent[] {
  const events: OrderflowEvent[] = [];
  for (const bucket of input.buckets) {
    const largestSide = bucket.largestTradeSide;
    const largestSize = Math.max(0, bucket.largestTradeSize);
    if (largestSize > 0) {
      events.push({
        type: "trade",
        receivedAt: bucket.bucketMs,
        trade: {
          asset: input.asset,
          side: largestSide,
          price: Number.isFinite(bucket.largestTradePrice) && bucket.largestTradePrice > 0 ? bucket.largestTradePrice : bucket.close,
          size: largestSize,
          time: bucket.bucketMs,
          id: `${bucket.bucketMs}:largest:${largestSide}`,
        },
      });
    }

    const buyResidual = Math.max(0, bucket.buyVolume - (largestSide === "buy" ? largestSize : 0));
    const sellResidual = Math.max(0, bucket.sellVolume - (largestSide === "sell" ? largestSize : 0));
    if (buyResidual > 0) {
      events.push({
        type: "trade",
        receivedAt: bucket.bucketMs + 1,
        trade: {
          asset: input.asset,
          side: "buy",
          price: bucket.close,
          size: buyResidual,
          time: bucket.bucketMs + 1,
          id: `${bucket.bucketMs}:buy-residual`,
        },
      });
    }
    if (sellResidual > 0) {
      events.push({
        type: "trade",
        receivedAt: bucket.bucketMs + 2,
        trade: {
          asset: input.asset,
          side: "sell",
          price: bucket.close,
          size: sellResidual,
          time: bucket.bucketMs + 2,
          id: `${bucket.bucketMs}:sell-residual`,
        },
      });
    }
  }
  return events;
}
