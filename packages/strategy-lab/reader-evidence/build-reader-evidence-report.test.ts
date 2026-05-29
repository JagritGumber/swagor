import { describe, expect, test } from "bun:test";
import { buildReaderEvidenceReport } from "./build-reader-evidence-report";
import type { ReaderEvidenceInput } from "./types";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome } from "../reader-result/types";
import type { ReaderSetupResult } from "../reader-setup/types";
import type { Candle } from "../types";

describe("buildReaderEvidenceReport", () => {
  test("uses only candles closed at entry and exit time", () => {
    const report = buildReaderEvidenceReport(inputFor({
      entryAt: candleTime(60) + 30_000,
      exitAt: candleTime(63) + 30_000,
    }));

    const trade = report.trades[0]!;
    expect(trade.candles.entryClosedCandle?.t).toBe(candleTime(59));
    expect(trade.candles.exitClosedCandle?.t).toBe(candleTime(62));
    expect(trade.candles.afterExit[0]?.t).toBe(candleTime(63));
  });

  test("counts missing price reads while trade is open and marks unusable sparse coverage", () => {
    const report = buildReaderEvidenceReport(inputFor({
      entryAt: closeTime(59),
      exitAt: closeTime(70),
      events: [
        held(closeTime(60)),
        unpriced(closeTime(61)),
        unpriced(closeTime(62)),
        unpriced(closeTime(80)),
      ],
    }));

    const trade = report.trades[0]!;
    expect(trade.execution.heldReads).toBe(2);
    expect(trade.execution.missingPriceReads).toBe(2);
    expect(trade.execution.quality).toBe("unusable");
    expect(trade.verdict).toBe("result-unusable-price-coverage");
    expect(report.dataQuality.unusableTrades).toBe(1);
  });

  test("open trades include before-entry candles without after-exit candles", () => {
    const report = buildReaderEvidenceReport(inputFor({
      entryAt: closeTime(59),
      exitAt: null,
    }));

    const trade = report.trades[0]!;
    expect(trade.candles.beforeEntry).toHaveLength(50);
    expect(trade.candles.exitClosedCandle).toBeNull();
    expect(trade.candles.afterExit).toHaveLength(0);
    expect(trade.execution.quality).toBe("open");
    expect(trade.verdict).toBe("open-trade");
  });

  test("includes setup lifecycle events up to entry", () => {
    const report = buildReaderEvidenceReport(inputFor({
      entryAt: closeTime(59),
      exitAt: closeTime(70),
      setupEvents: [
        { type: "setup-none", key: "BTC|5m", asset: "BTC", at: closeTime(54), reason: "no setup" },
        { type: "setup-created", key: "BTC|5m", asset: "BTC", at: closeTime(55), reason: "created" },
        { type: "setup-held", key: "BTC|5m", asset: "BTC", at: closeTime(56), reason: "held" },
        { type: "setup-ready", key: "BTC|5m", asset: "BTC", at: closeTime(59), reason: "ready" },
        { type: "setup-held", key: "BTC|5m", asset: "BTC", at: closeTime(80), reason: "future" },
      ],
    }));

    expect(report.trades[0]?.setup.events.map((event) => event.reason)).toEqual(["created", "held", "ready"]);
  });
});

function inputFor(input: {
  candles?: Candle[];
  entryAt: number;
  exitAt: number | null;
  entryPrice?: number;
  events?: ReaderResultEvent[];
  setupEvents?: ReaderSetupResult["events"];
}): ReaderEvidenceInput {
  const entry: ReaderResultEntry = {
    asset: "BTC",
    setupKey: "BTC|5m",
    side: "long",
    entryPrice: input.entryPrice ?? 100,
    entryAt: input.entryAt,
    stop: 98,
    target: 104,
    confidence: 0.7,
    reasons: ["support reclaim"],
  };
  const outcome: ReaderResultOutcome | null = input.exitAt === null
    ? null
    : {
        ...entry,
        exitPrice: 98,
        exitAt: input.exitAt,
        exitReason: "stop",
        r: -1,
      };
  const setup = setupResult(entry, input.setupEvents);

  return {
    candles: input.candles ?? candles(100),
    candleIntervalMs: 300_000,
    replay: {
      summary: {
        totalReads: 1,
        totalEntries: 1,
        entriesOpened: 1,
        totalOutcomes: outcome ? 1 : 0,
        wins: 0,
        losses: outcome ? 1 : 0,
        winRate: 0,
        totalR: outcome?.r ?? 0,
        averageR: outcome?.r ?? 0,
        maxDrawdownR: outcome?.r ?? 0,
      },
      entries: [entry],
      outcomes: outcome ? [outcome] : [],
      open: outcome ? null : entry,
      resultUpdates: [
        { input: setup, opened: entry, closed: null, events: [opened(input.entryAt)] },
        ...(input.events ?? []).map((event) => ({ input: setup, opened: null, closed: null, events: [event] })),
        ...(outcome ? [{ input: setup, opened: null, closed: outcome, events: [stop(outcome.exitAt)] }] : []),
      ],
    },
  };
}

function setupResult(entry: ReaderResultEntry, events?: ReaderSetupResult["events"]): ReaderSetupResult {
  return {
    read: read(),
    plan: {
      status: "ready",
      asset: entry.asset,
      side: entry.side,
      entryLow: 99,
      entryHigh: 101,
      stop: entry.stop,
      target: entry.target,
      invalidation: "below support",
      confidence: entry.confidence,
      reasons: entry.reasons,
    },
    setup: {
      key: entry.setupKey!,
      scope: null,
      asset: entry.asset,
      interval: "5m",
      side: entry.side,
      status: "ready",
      plan: {
        status: "ready",
        asset: entry.asset,
        side: entry.side,
        entryLow: 99,
        entryHigh: 101,
        stop: entry.stop,
        target: entry.target,
        invalidation: "below support",
        confidence: entry.confidence,
        reasons: entry.reasons,
      },
      createdAt: entry.entryAt - 600_000,
      updatedAt: entry.entryAt,
      lastReadAt: entry.entryAt,
      readCount: 3,
      lastReason: "ready",
    },
    events: events ?? [{ type: "setup-ready", key: entry.setupKey!, asset: entry.asset, at: entry.entryAt, reason: "ready" }],
    planSource: "memory-promoted",
  };
}

function read(): LiveReaderRead {
  return {
    asset: "BTC",
    stance: "possible-long",
    narrative: "reader narrative",
    invalidation: "below support",
    target: "value high",
    auction: {
      asset: "BTC",
      interval: "5m",
      level: { price: 99, kind: "support", touches: 3, firstTouchedAt: 1, lastTouchedAt: 2 },
      profile: {
        low: 90,
        high: 110,
        binSize: 1,
        poc: 101,
        valueAreaLow: 95,
        valueAreaHigh: 105,
        bins: [
          { low: 90, high: 100, mid: 95, volume: 10 },
          { low: 100, high: 110, mid: 105, volume: 15 },
        ],
      },
      location: "value-low",
      bias: "long",
      narrative: "auction narrative",
      invalidation: "auction invalidation",
      target: "auction target",
    },
    orderflow: {
      asset: "BTC",
      windowSeconds: 300,
      lastPrice: 100,
      buyVolume: 20,
      sellVolume: 12,
      delta: 8,
      tradeCount: 10,
      averageTradeSize: 3.2,
      largestTrade: null,
      dominantSide: "buy",
      pressure: "buy-pressure",
      events: ["stalled-selling"],
      narrative: "orderflow narrative",
    },
  };
}

function candles(count: number): Candle[] {
  return Array.from({ length: count }, (_, index) => ({
    t: candleTime(index),
    o: 100 + index,
    h: 101 + index,
    l: 99 + index,
    c: 100.5 + index,
    v: 10 + index,
  }));
}

function candleTime(index: number): number {
  return 1_000_000 + index * 300_000;
}

function closeTime(index: number): number {
  return candleTime(index) + 300_000;
}

function opened(at: number): ReaderResultEvent {
  return { type: "entry-opened", asset: "BTC", side: "long", price: 100, at, reason: "opened" };
}

function held(at: number): ReaderResultEvent {
  return { type: "position-held", asset: "BTC", side: "long", price: 100, at, reason: "held" };
}

function unpriced(at: number): ReaderResultEvent {
  return { type: "position-unpriced", asset: "BTC", side: "long", at, reason: "missing" };
}

function stop(at: number): ReaderResultEvent {
  return { type: "stop-hit", asset: "BTC", side: "long", price: 98, r: -1, at, reason: "stop" };
}
