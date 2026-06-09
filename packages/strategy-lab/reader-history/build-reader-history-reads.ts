import { createOrderflowWindow } from "../orderflow/create-orderflow-window";
import { expireOrderflowWindow } from "../orderflow/expire-orderflow-window";
import { readOrderflowWindow } from "../orderflow/read-orderflow-window";
import { updateOrderflowWindow } from "../orderflow/update-orderflow-window";
import { readMarketRegime } from "../market-regime/read-market-regime";
import { buildTradeVolumeProfileFromRange } from "../read/build-trade-volume-profile";
import { clusterPriceLevels } from "../read/cluster-price-levels";
import { findSwingHighs } from "../read/find-swing-highs";
import { findSwingLows } from "../read/find-swing-lows";
import { nearestPriceLevel } from "../read/nearest-price-level";
import { readAuctionAtLevel } from "../read/read-auction-at-level";
import { createReaderAuctionModeState } from "../reader-auction-mode/create-reader-auction-mode-state";
import { combineAuctionOrderflow } from "../reader-live/combine-auction-orderflow";
import { createReaderVpStateMemory } from "../reader-vp-state/create-reader-vp-state-memory";
import type { OrderflowEvent, OrderflowTrade } from "../orderflow/types";
import type { AuctionRead, PriceLevel } from "../read/types";
import type { Candle } from "../types";
import type { ReaderHistoryInput, ReaderHistoryStep } from "./types";

export function buildReaderHistoryReads(input: ReaderHistoryInput): ReaderHistoryStep[] {
  if (!Number.isFinite(input.readIntervalMs) || input.readIntervalMs <= 0) {
    throw new Error("reader history readIntervalMs must be a positive finite number");
  }
  if (!Number.isFinite(input.candleIntervalMs) || input.candleIntervalMs <= 0) {
    throw new Error("reader history candleIntervalMs must be a positive finite number");
  }
  if (input.alignReadsToMs !== undefined && (!Number.isFinite(input.alignReadsToMs) || input.alignReadsToMs <= 0)) {
    throw new Error("reader history alignReadsToMs must be a positive finite number");
  }
  if (input.auctionConfig?.localRangeCandles !== undefined && (!Number.isFinite(input.auctionConfig.localRangeCandles) || input.auctionConfig.localRangeCandles <= 0)) {
    throw new Error("reader history localRangeCandles must be a positive finite number");
  }
  const asset = input.asset.toUpperCase();
  const candles = sortedCandles(input.candles);
  const events = sortedEvents(input.orderflowEvents.filter((event) => eventAsset(event) === asset));
  const bounds = timeBounds({ candles, events, startAt: input.startAt, endAt: input.endAt });
  if (!bounds) return [];

  const window = createOrderflowWindow(input.orderflowWindowMs ?? 60_000);
  const profileWindowMs = input.auctionConfig?.profileTradeWindowMs ?? (input.auctionConfig?.profileCandles ?? 120) * input.candleIntervalMs;
  const profileWindow = createOrderflowWindow(profileWindowMs);
  const auctionModeState = createReaderAuctionModeState();
  const vpStateMemory = createReaderVpStateMemory();
  const steps: ReaderHistoryStep[] = [];
  let candleIndex = 0;
  let eventIndex = 0;
  let activeCandles: Candle[] = [];
  let activeCandlesUntilIndex = -1;
  const auctionCache: HistoryAuctionCache = {
    candleIndex: -1,
    levels: [],
  };

  const firstReadAt = alignedStart(bounds.startAt, input.alignReadsToMs);
  for (let now = firstReadAt; now <= bounds.endAt; now += input.readIntervalMs) {
    while (candleIndex < candles.length && candles[candleIndex].t + input.candleIntervalMs <= now) candleIndex += 1;
    while (eventIndex < events.length && eventTime(events[eventIndex]) <= now) {
      updateOrderflowWindow(window, events[eventIndex]);
      updateOrderflowWindow(profileWindow, events[eventIndex]);
      eventIndex += 1;
    }
    expireOrderflowWindow(window, now);
    expireOrderflowWindow(profileWindow, now);

    if (activeCandlesUntilIndex !== candleIndex) {
      activeCandles = candles.slice(0, candleIndex);
      activeCandlesUntilIndex = candleIndex;
    }
    if (activeCandles.length === 0) continue;
    const orderflow = readOrderflowWindow({ asset, window });
    const regime = readMarketRegime({ candles: activeCandles, now });
    const auction = readHistoryAuction({
      asset,
      interval: input.interval,
      candles: activeCandles,
      candleIndex,
      cache: auctionCache,
      config: input.auctionConfig,
      profileTradeWindow: {
        trades: profileWindow.trades,
        startIndex: profileWindow.startIndex,
        endIndex: profileWindow.trades.length,
        sampleLimit: input.auctionConfig?.profileTradeSampleLimit ?? 20_000,
      },
      price: orderflow.lastPrice ?? activeCandles[activeCandles.length - 1].c,
    });
    steps.push({
      now,
      read: combineAuctionOrderflow({
        auction,
        orderflow,
        regime,
        auctionModeState,
        vpStateMemory,
        lastClosedCandle: activeCandles[activeCandles.length - 1] ?? null,
        localRange: localRangeFor({
          candles: activeCandles,
          price: orderflow.lastPrice ?? activeCandles[activeCandles.length - 1]?.c ?? null,
          windowCandles: input.auctionConfig?.localRangeCandles ?? localRangeCandlesFor(input),
        }),
        config: input.readerConfig,
      }),
    });
  }

  return steps;
}

type HistoryAuctionCache = {
  candleIndex: number;
  levels: PriceLevel[];
};

function readHistoryAuction(input: {
  asset: string;
  interval: string;
  candles: Candle[];
  candleIndex: number;
  cache: HistoryAuctionCache;
  config: ReaderHistoryInput["auctionConfig"];
  profileTradeWindow: HistoryProfileTradeWindow;
  price: number;
}): AuctionRead {
  if (input.cache.candleIndex !== input.candleIndex) {
    input.cache.levels = historyPriceLevels({
      candles: input.candles,
      config: input.config,
    });
    input.cache.candleIndex = input.candleIndex;
  }
  const level = nearestPriceLevel({
    levels: input.cache.levels,
    price: input.price,
    maxDistancePct: input.config?.maxLevelDistancePct ?? 0.012,
  });
  const profile = input.profileTradeWindow.endIndex > input.profileTradeWindow.startIndex
    ? buildTradeVolumeProfileFromRange({
      ...input.profileTradeWindow,
      anchorPrice: level?.price ?? input.price,
      radiusPct: input.config?.profileRadiusPct ?? 0.015,
      binCount: input.config?.profileBins ?? 24,
    })
    : null;
  return readAuctionAtLevel({
    asset: input.asset,
    interval: input.interval,
    candles: input.candles,
    level,
    profileCandles: input.config?.profileCandles ?? 120,
    radiusPct: input.config?.profileRadiusPct ?? 0.015,
    binCount: input.config?.profileBins ?? 24,
    profileOverride: profile,
    price: input.price,
  });
}

type HistoryProfileTradeWindow = {
  trades: OrderflowTrade[];
  startIndex: number;
  endIndex: number;
  sampleLimit: number;
};

function historyPriceLevels(input: {
  candles: Candle[];
  config: ReaderHistoryInput["auctionConfig"];
}): PriceLevel[] {
  const swingLeft = input.config?.swingLeft ?? 3;
  const swingRight = input.config?.swingRight ?? 3;
  const candles = levelDetectionCandles({
    candles: input.candles,
    limit: input.config?.levelCandles,
  });
  const supports = findSwingLows({ candles, left: swingLeft, right: swingRight });
  const resistances = findSwingHighs({ candles, left: swingLeft, right: swingRight });
  return clusterPriceLevels({
    supports,
    resistances,
    tolerancePct: input.config?.levelTolerancePct ?? 0.003,
    minTouches: input.config?.levelMinTouches ?? 2,
  });
}

function levelDetectionCandles(input: {
  candles: Candle[];
  limit: number | undefined;
}): Candle[] {
  if (input.limit === undefined || input.candles.length <= input.limit) return input.candles;
  return input.candles.slice(input.candles.length - input.limit);
}

function localRangeCandlesFor(input: ReaderHistoryInput): number {
  return input.auctionConfig?.profileCandles ?? 50;
}

function localRangeFor(input: {
  candles: Candle[];
  price: number | null;
  windowCandles: number;
}) {
  const candles = input.candles.slice(Math.max(0, input.candles.length - input.windowCandles));
  if (candles.length === 0 || input.price === null) {
    return {
      high: null,
      low: null,
      position: null,
      location: "unknown" as const,
    };
  }
  const high = Math.max(...candles.map((candle) => candle.h));
  const low = Math.min(...candles.map((candle) => candle.l));
  if (!Number.isFinite(high) || !Number.isFinite(low) || high === low) {
    return {
      high: null,
      low: null,
      position: null,
      location: "unknown" as const,
    };
  }
  const position = (input.price - low) / (high - low);
  return {
    high,
    low,
    position,
    location: localRangeLocationFor(position),
  };
}

function localRangeLocationFor(position: number) {
  if (position <= 0.25) return "lower-edge" as const;
  if (position >= 0.75) return "upper-edge" as const;
  return "middle" as const;
}

function sortedCandles(candles: Candle[]): Candle[] {
  return [...candles].sort((a, b) => a.t - b.t);
}

function sortedEvents(events: OrderflowEvent[]): OrderflowEvent[] {
  return [...events].sort((a, b) => eventTime(a) - eventTime(b));
}

function timeBounds(input: {
  candles: Candle[];
  events: OrderflowEvent[];
  startAt?: number;
  endAt?: number;
}): { startAt: number; endAt: number } | null {
  const firstCandle = input.candles[0]?.t;
  const lastCandle = input.candles[input.candles.length - 1]?.t;
  const firstEvent = input.events[0] ? eventTime(input.events[0]) : undefined;
  const lastEvent = input.events[input.events.length - 1] ? eventTime(input.events[input.events.length - 1]) : undefined;
  const startAt = input.startAt ?? minDefined(firstCandle, firstEvent);
  const endAt = input.endAt ?? maxDefined(lastCandle, lastEvent);
  if (startAt === undefined || endAt === undefined || startAt > endAt) return null;
  return { startAt, endAt };
}

function minDefined(...values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined);
  if (defined.length === 0) return undefined;
  return Math.min(...defined);
}

function maxDefined(...values: Array<number | undefined>): number | undefined {
  const defined = values.filter((value): value is number => value !== undefined);
  if (defined.length === 0) return undefined;
  return Math.max(...defined);
}

function eventTime(event: OrderflowEvent): number {
  return event.type === "trade" ? event.trade.time : event.bbo.time;
}

function eventAsset(event: OrderflowEvent): string {
  return (event.type === "trade" ? event.trade.asset : event.bbo.asset).toUpperCase();
}

function alignedStart(startAt: number, alignReadsToMs: number | undefined): number {
  if (alignReadsToMs === undefined) return startAt;
  return Math.ceil(startAt / alignReadsToMs) * alignReadsToMs;
}
