import { describe, expect, test } from "bun:test";
import { analyzeReaderExecutionQuality } from "./analyze-reader-execution-quality";
import type { ReaderExecutionQualityInput } from "./types";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome } from "../reader-result/types";
import type { ReaderSetupResult } from "../reader-setup/types";

describe("analyzeReaderExecutionQuality", () => {
  test("clean trade with only priced reads reports clean", () => {
    const report = analyzeReaderExecutionQuality(inputFor({
      events: [
        held(2),
        held(3),
        stop(4),
      ],
    }));

    expect(report.priceCoveragePct).toBe(100);
    expect(report.replayQuality).toBe("clean");
    expect(report.trades[0]?.quality).toBe("clean");
    expect(report.trades[0]?.diagnosis).toBe("clean-price-coverage");
  });

  test("one unpriced read with enough coverage reports degraded", () => {
    const report = analyzeReaderExecutionQuality(inputFor({
      events: [
        held(2),
        held(3),
        unpriced(4),
        held(5),
        held(6),
        stop(7),
      ],
    }));

    expect(report.trades[0]?.coveragePctWhileOpen).toBe(83.33);
    expect(report.trades[0]?.quality).toBe("degraded");
    expect(report.trades[0]?.diagnosis).toBe("missing-price-while-open");
  });

  test("three consecutive unpriced reads reports unusable", () => {
    const report = analyzeReaderExecutionQuality(inputFor({
      readIntervalMs: 60_000,
      events: [
        held(2),
        unpriced(3),
        unpriced(4),
        unpriced(5),
        held(6),
        stop(7),
      ],
    }));

    expect(report.trades[0]?.quality).toBe("unusable");
    expect(report.trades[0]?.diagnosis).toBe("long-unpriced-gap");
    expect(report.trades[0]?.longestUnpricedGapMsWhileOpen).toBe(180_000);
  });

  test("coverage below eighty percent reports unusable", () => {
    const report = analyzeReaderExecutionQuality(inputFor({
      events: [
        held(2),
        unpriced(3),
        held(4),
        stop(5),
      ],
    }));

    expect(report.trades[0]?.coveragePctWhileOpen).toBe(75);
    expect(report.trades[0]?.quality).toBe("unusable");
    expect(report.trades[0]?.diagnosis).toBe("sparse-price-coverage");
  });

  test("unpriced reads outside the trade window do not affect trade quality", () => {
    const report = analyzeReaderExecutionQuality(inputFor({
      events: [
        unpriced(0),
        held(2),
        stop(3),
        unpriced(4),
      ],
    }));

    expect(report.unpricedReads).toBe(2);
    expect(report.trades[0]?.unpricedReadsWhileOpen).toBe(0);
    expect(report.trades[0]?.quality).toBe("clean");
  });

  test("open trade reports open while still measuring later reads", () => {
    const report = analyzeReaderExecutionQuality(inputFor({
      exitAt: null,
      events: [
        held(2),
        unpriced(3),
      ],
    }));

    expect(report.replayQuality).toBe("open");
    expect(report.trades[0]?.quality).toBe("open");
    expect(report.trades[0]?.diagnosis).toBe("open-trade");
    expect(report.trades[0]?.unpricedReadsWhileOpen).toBe(1);
  });
});

function inputFor(input: {
  events: ReaderResultEvent[];
  readIntervalMs?: number;
  exitAt?: number | null;
}): ReaderExecutionQualityInput {
  const entry = entryFor(1);
  const inferredExitAt = input.events.find((event) => event.type === "stop-hit" || event.type === "target-hit")?.at ?? 4;
  const outcome = input.exitAt === null ? null : outcomeFor(entry, input.exitAt ?? inferredExitAt);
  return {
    readIntervalMs: input.readIntervalMs,
    replay: {
      summary: {
        totalReads: input.events.length,
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
        { input: setup(), opened: entry, closed: null, events: [opened(1)] },
        ...input.events.map((event) => ({ input: setup(), opened: null, closed: event.type === "stop-hit" ? outcome : null, events: [event] })),
      ],
    },
  };
}

function entryFor(at: number): ReaderResultEntry {
  return {
    asset: "BTC",
    setupKey: "BTC|5m",
    side: "long",
    entryPrice: 100,
    entryAt: at,
    stop: 98,
    target: 104,
    confidence: 0.7,
    reasons: ["test"],
  };
}

function outcomeFor(entry: ReaderResultEntry, exitAt: number): ReaderResultOutcome {
  return {
    ...entry,
    exitPrice: 98,
    exitAt,
    exitReason: "stop",
    r: -1,
  };
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

function setup(): ReaderSetupResult {
  return {
    read: null as unknown as ReaderSetupResult["read"],
    plan: null as unknown as ReaderSetupResult["plan"],
    setup: null,
    events: [],
    planSource: "none",
  };
}
