import { intervalMs, readOrderflowBuckets } from "../market-data";
import { analyzeReaderExecutionQuality } from "../strategy-lab/reader/reader-execution-quality/analyze-reader-execution-quality";
import { buildReaderEvidenceReport } from "../strategy-lab/reader/reader-evidence/build-reader-evidence-report";
import { runReaderHistoryReplay } from "../strategy-lab/reader/reader-history/run-reader-history-replay";
import type { ReaderHistoryAuctionConfig, ReaderHistoryReplayResult } from "../strategy-lab/reader/reader-history/types";
import type { ReaderExecutionQualityReport } from "../strategy-lab/reader/reader-execution-quality/types";
import type { ReaderEvidenceReport } from "../strategy-lab/reader/reader-evidence/types";
import type { ReaderRadarConfig } from "../strategy-lab/reader/reader-radar/types";
import type { ReaderSetupConfig } from "../strategy-lab/reader/reader-setup/types";
import type { OrderflowEvent, OrderflowSide } from "../strategy-lab/read-core/orderflow/types";
import type { Candle } from "../strategy-lab/types";
import type { CandleInterval, MarketStoreMarket, MarketStoreVenue, OrderflowBucket } from "../market-data";

export type MarketStoreReaderReplayInput = {
  rootDir: string;
  venue: MarketStoreVenue;
  market: MarketStoreMarket;
  symbol: string;
  asset?: string;
  interval: CandleInterval;
  startMs: number;
  endMs: number;
  readIntervalMs: number;
  orderflowWindowMs?: number;
  setupTtlMs?: number;
  auctionConfig?: ReaderHistoryAuctionConfig;
  setupConfig?: ReaderSetupConfig;
  radarConfig?: ReaderRadarConfig;
};

export type MarketStoreReaderReplayDiagnostics = {
  bucketCount: number;
  candleCount: number;
  syntheticOrderflowEventCount: number;
  firstBucketAt: number | null;
  lastBucketAt: number | null;
  source: "market-store-1s-buckets";
  fidelity: "bucket-derived-orderflow";
};

export type MarketStoreReaderReplayReport = ReaderHistoryReplayResult & {
  diagnostics: MarketStoreReaderReplayDiagnostics;
  executionQuality: ReaderExecutionQualityReport;
  evidence: ReaderEvidenceReport;
};

export async function runMarketStoreReaderReplayReport(input: MarketStoreReaderReplayInput): Promise<MarketStoreReaderReplayReport> {
  const asset = (input.asset ?? input.symbol).toUpperCase();
  const buckets = await readOrderflowBuckets(input);
  const candleIntervalMs = intervalMs(input.interval);
  const candles = candlesFromBuckets({ buckets, intervalMs: candleIntervalMs });
  const orderflowEvents = orderflowEventsFromBuckets({ asset, buckets });
  const replay = runReaderHistoryReplay({
    asset,
    interval: input.interval,
    candleIntervalMs,
    candles,
    orderflowEvents,
    readIntervalMs: input.readIntervalMs,
    orderflowWindowMs: input.orderflowWindowMs,
    startAt: input.startMs,
    endAt: input.endMs,
    auctionConfig: input.auctionConfig,
    replay: {
      setupConfig: {
        ...input.setupConfig,
        ...(input.setupTtlMs === undefined ? {} : { setupTtlMs: input.setupTtlMs }),
      },
      radarConfig: input.radarConfig,
    },
  });
  const executionQuality = analyzeReaderExecutionQuality({
    readIntervalMs: input.readIntervalMs,
    replay,
  });

  return {
    ...replay,
    diagnostics: {
      bucketCount: buckets.length,
      candleCount: candles.length,
      syntheticOrderflowEventCount: orderflowEvents.length,
      firstBucketAt: buckets[0]?.bucketMs ?? null,
      lastBucketAt: buckets.at(-1)?.bucketMs ?? null,
      source: "market-store-1s-buckets",
      fidelity: "bucket-derived-orderflow",
    },
    executionQuality,
    evidence: buildReaderEvidenceReport({
      candles,
      candleIntervalMs,
      readIntervalMs: input.readIntervalMs,
      executionQuality,
      replay,
    }),
  };
}

function candlesFromBuckets(input: { buckets: OrderflowBucket[]; intervalMs: number }): Candle[] {
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

function orderflowEventsFromBuckets(input: { asset: string; buckets: OrderflowBucket[] }): OrderflowEvent[] {
  const events: OrderflowEvent[] = [];
  for (const bucket of input.buckets) {
    const largestSide = bucket.largestTradeSide;
    const largestSize = Math.max(0, bucket.largestTradeSize);
    if (largestSize > 0) {
      events.push(tradeEvent({
        asset: input.asset,
        side: largestSide,
        price: finitePrice(bucket.largestTradePrice, bucket.close),
        size: largestSize,
        time: bucket.bucketMs,
        id: `${bucket.bucketMs}:largest:${largestSide}`,
      }));
    }

    const buyResidual = residualVolume(bucket.buyVolume, largestSide === "buy" ? largestSize : 0);
    const sellResidual = residualVolume(bucket.sellVolume, largestSide === "sell" ? largestSize : 0);
    if (buyResidual > 0) {
      events.push(tradeEvent({
        asset: input.asset,
        side: "buy",
        price: bucket.close,
        size: buyResidual,
        time: bucket.bucketMs + 1,
        id: `${bucket.bucketMs}:buy-residual`,
      }));
    }
    if (sellResidual > 0) {
      events.push(tradeEvent({
        asset: input.asset,
        side: "sell",
        price: bucket.close,
        size: sellResidual,
        time: bucket.bucketMs + 2,
        id: `${bucket.bucketMs}:sell-residual`,
      }));
    }
  }
  return events;
}

function tradeEvent(input: {
  asset: string;
  side: OrderflowSide;
  price: number;
  size: number;
  time: number;
  id: string;
}): OrderflowEvent {
  return {
    type: "trade",
    receivedAt: input.time,
    trade: {
      asset: input.asset,
      side: input.side,
      price: input.price,
      size: input.size,
      time: input.time,
      id: input.id,
    },
  };
}

function residualVolume(total: number, removed: number): number {
  return Math.max(0, total - removed);
}

function finitePrice(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
