import { readOrderflowBuckets, intervalMs } from "../packages/market-data";
import { runReaderReplay } from "../packages/strategy-lab/reader/reader-replay/run-reader-replay";
import { buildReaderHistoryReads } from "../packages/strategy-lab/reader/reader-history/build-reader-history-reads";
import { buildOrLoadHistorySteps } from "../packages/strategy-lab/reader/reader-history/history-cache";
import type { ReaderTradePlanConfig } from "../packages/strategy-lab/backtest/trade-plan/types";
import type { OrderflowEvent } from "../packages/strategy-lab/read-core/orderflow/types";
import type { Candle } from "../packages/strategy-lab/types";

const BENCHMARK_CONFIG: { label: string; config: { tradePlanConfig: ReaderTradePlanConfig } }[] = [
  {
    label: "baseline (no filters)",
    config: { tradePlanConfig: {} },
  },
  {
    label: "benchmark: trend-down + trade count 500-1000",
    config: {
      tradePlanConfig: {
        allowedRegimes: ["trend-down"],
        minTradeCount: 500,
        maxTradeCount: 1000,
      },
    },
  },
];

type MonthResult = {
  month: string;
  label: string;
  entries: number;
  wins: number;
  totalR: number;
  rPerTrade: number;
  maxDD: number;
  winRate: number;
};

async function runMonth(year: number, month: number): Promise<MonthResult[]> {
  const label = `${year}-${String(month + 1).padStart(2, "0")}`;
  const startMs = Date.UTC(year, month, 1);
  const endMs = Date.UTC(year, month + 1, 0, 23, 59, 59, 999);

  console.log(`\n--- ${label} ---`);
  const monthStart = Date.now();

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
  console.log(`  Data loaded: ${buckets.length} buckets, ${candles.length} candles, ${orderflowEvents.length} events`);

  const historySteps = buildReaderHistoryReads({
    asset,
    interval: "5m",
    candleIntervalMs,
    candles,
    orderflowEvents,
    readIntervalMs: 5000,
    orderflowWindowMs: 60_000,
    startAt: startMs,
    endAt: endMs,
  });
  console.log(`  History: ${historySteps.length} steps`);

  const results: MonthResult[] = [];
  for (const { label: configLabel, config } of BENCHMARK_CONFIG) {
    const replayStart = Date.now();
    const replay = runReaderReplay({
      reads: historySteps,
      requireTimestamps: true,
      setupConfig: config,
      skipResultSnapshots: true,
    });

    const s = replay.summary;
    const rPerTrade = s.totalEntries > 0 ? s.totalR / s.totalEntries : 0;
    const elapsed = ((Date.now() - replayStart) / 1000).toFixed(1);

    console.log(`  ${configLabel}: ${s.totalEntries} entries, WR ${(s.winRate * 100).toFixed(1)}%, R ${s.totalR > 0 ? "+" : ""}${s.totalR.toFixed(2)}, avg ${rPerTrade.toFixed(4)}R/trade, DD ${s.maxDrawdownR.toFixed(2)}R [${elapsed}s]`);

    results.push({
      month: label,
      label: configLabel,
      entries: s.totalEntries,
      wins: Math.round(s.winRate * s.totalEntries),
      totalR: s.totalR,
      rPerTrade,
      maxDD: s.maxDrawdownR,
      winRate: s.winRate,
    });
  }

  console.log(`  Month completed in ${((Date.now() - monthStart) / 1000).toFixed(1)}s`);
  return results;
}

async function main() {
  const overallStart = Date.now();
  const allResults: MonthResult[] = [];

  // Training months: May-Jul
  console.log("=== TRAINING PERIOD (May-Jul 2025) ===");
  for (const m of [4, 5, 6]) {
    allResults.push(...await runMonth(2025, m));
  }

  // Test months: Aug-Sep
  console.log("\n=== TEST PERIOD (Aug-Sep 2025) ===");
  for (const m of [7, 8]) {
    allResults.push(...await runMonth(2025, m));
  }

  // Summary
  console.log("\n========== VALIDATION SUMMARY ==========");
  console.log(`Total elapsed: ${((Date.now() - overallStart) / 1000).toFixed(1)}s`);

  for (const { label } of BENCHMARK_CONFIG) {
    const train = allResults.filter((r) => r.label === label && ["2025-05", "2025-06", "2025-07"].includes(r.month));
    const test = allResults.filter((r) => r.label === label && ["2025-08", "2025-09"].includes(r.month));

    const trainEntries = train.reduce((s, r) => s + r.entries, 0);
    const trainR = train.reduce((s, r) => s + r.totalR, 0);
    const trainRPerTrade = trainEntries > 0 ? trainR / trainEntries : 0;
    const trainDD = Math.min(...train.map((r) => r.maxDD));

    const testEntries = test.reduce((s, r) => s + r.entries, 0);
    const testR = test.reduce((s, r) => s + r.totalR, 0);
    const testRPerTrade = testEntries > 0 ? testR / testEntries : 0;
    const testDD = Math.min(...test.map((r) => r.maxDD));

    console.log(`\n${label}:`);
    console.log(`  Train (May-Jul): ${trainEntries} trades, ${trainR > 0 ? "+" : ""}${trainR.toFixed(2)}R, ${trainRPerTrade.toFixed(4)}R/trade, DD ${trainDD.toFixed(2)}R`);
    console.log(`  Test  (Aug-Sep): ${testEntries} trades, ${testR > 0 ? "+" : ""}${testR.toFixed(2)}R, ${testRPerTrade.toFixed(4)}R/trade, DD ${testDD.toFixed(2)}R`);
    console.log(`  Degradation: R/trade ${((1 - testRPerTrade / trainRPerTrade) * 100).toFixed(1)}% ${testRPerTrade < trainRPerTrade ? "WORSE" : "BETTER"}`);
  }

  // Benchmark reference
  console.log("\n--- Benchmark Reference (184 days) ---");
  console.log("  vp-trend-down-active-price-follow-025: 140 trades, +229.51R, 1.64R/trade, 40.71% WR, -11.17R DD");
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

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
