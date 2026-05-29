import { describe, expect, test } from "bun:test";
import { buildReaderFormationTape } from "./build-reader-formation-tape";
import type { ReaderResultEntry, ReaderResultEvent, ReaderResultOutcome, ReaderResultUpdate } from "../reader-result/types";
import type { ReaderSetupResult } from "../reader-setup/types";

describe("buildReaderFormationTape", () => {
  test("keeps formation rows scoped to the entry asset and setup key", () => {
    const entry = entryFor(4);
    const setupResults = [
      setupResult(1, { asset: "ETH", setupKey: "ETH|5m" }),
      setupResult(2, { asset: "BTC", setupKey: "BTC|15m" }),
      setupResult(3, { asset: "BTC", setupKey: "BTC|5m" }),
      setupResult(4, { asset: "BTC", setupKey: "BTC|5m" }),
    ];
    const resultUpdates = resultUpdatesFor({ entry, outcome: null, setupResults });
    const tape = buildReaderFormationTape({
      setupResults,
      resultUpdates,
      entries: [entry],
      outcomes: [],
    })[0]!;

    expect(tape.beforeEntry.map((read) => read.at)).toEqual([3, 4]);
    expect(tape.beforeEntry.every((read) => read.asset === "BTC")).toBe(true);
    expect(tape.beforeEntry.every((read) => read.setupKey === "BTC|5m")).toBe(true);
  });

  test("separates significant formation reads from neutral rolling context", () => {
    const entry = entryFor(5);
    const setupResults = [
      setupResult(1, { orderflowEvents: [], setupEvents: [{ type: "setup-none", key: "BTC|5m", asset: "BTC", at: 1, reason: "none" }] }),
      setupResult(2, { orderflowEvents: [], setupEvents: [{ type: "setup-held", key: "BTC|5m", asset: "BTC", at: 2, reason: "held" }] }),
      setupResult(3, { orderflowEvents: [], setupEvents: [{ type: "setup-created", key: "BTC|5m", asset: "BTC", at: 3, reason: "created" }] }),
      setupResult(4, { orderflowEvents: ["stalled-selling"], setupEvents: [{ type: "setup-held", key: "BTC|5m", asset: "BTC", at: 4, reason: "held" }] }),
      setupResult(5, { orderflowEvents: ["stalled-selling"], setupEvents: [{ type: "setup-ready", key: "BTC|5m", asset: "BTC", at: 5, reason: "ready" }] }),
    ];
    const resultUpdates = resultUpdatesFor({ entry, outcome: null, setupResults });
    const tape = buildReaderFormationTape({
      setupResults,
      resultUpdates,
      entries: [entry],
      outcomes: [],
    })[0]!;

    expect(tape.beforeEntry.map((read) => read.at)).toEqual([1, 2, 3, 4, 5]);
    expect(tape.significantBeforeEntry.map((read) => read.at)).toEqual([3, 4, 5]);
  });

  test("preserves old setup landmarks while capping repeated orderflow significance", () => {
    const entry = entryFor(30);
    const setupResults = Array.from({ length: 30 }, (_, index) => {
      const at = index + 1;
      return setupResult(at, {
        orderflowEvents: at === 3 ? [] : ["large-print"],
        setupEvents: [
          at === 3
            ? { type: "setup-created", key: "BTC|5m", asset: "BTC", at, reason: "created" }
            : { type: "setup-none", key: "BTC|5m", asset: "BTC", at, reason: "none" },
        ],
      });
    });
    const resultUpdates = resultUpdatesFor({ entry, outcome: null, setupResults });
    const tape = buildReaderFormationTape({
      setupResults,
      resultUpdates,
      entries: [entry],
      outcomes: [],
    })[0]!;

    expect(tape.significantBeforeEntry.map((read) => read.at)).toEqual([3, ...Array.from({ length: 20 }, (_, index) => index + 11)]);
  });
});

function resultUpdatesFor(input: {
  entry: ReaderResultEntry;
  outcome: ReaderResultOutcome | null;
  setupResults: ReaderSetupResult[];
}): ReaderResultUpdate[] {
  return input.setupResults.map((setup, index) => {
    const at = index + 1;
    const opened = at === input.entry.entryAt ? input.entry : null;
    const closed = input.outcome && at === input.outcome.exitAt ? input.outcome : null;
    return {
      input: setup,
      state: {
        open: null,
        outcomes: [],
        events: [],
        maxEvents: 100,
      },
      opened,
      closed,
      events: eventsFor({ at, opened, closed }),
    };
  });
}

function eventsFor(input: {
  at: number;
  opened: ReaderResultEntry | null;
  closed: ReaderResultOutcome | null;
}): ReaderResultEvent[] {
  if (input.opened) return [{ type: "entry-opened", asset: "BTC", side: "long", price: 100, at: input.at, reason: "opened" }];
  if (input.closed) return [{ type: "target-hit", asset: "BTC", side: "long", price: 104, r: 1, at: input.at, reason: "target" }];
  return [{ type: "position-held", asset: "BTC", side: "long", price: 101, at: input.at, reason: "held" }];
}

function setupResult(at: number, options?: {
  asset?: string;
  setupKey?: string;
  orderflowEvents?: string[];
  setupEvents?: ReaderSetupResult["events"];
}): ReaderSetupResult {
  const asset = options?.asset ?? "BTC";
  const setupKey = options?.setupKey ?? `${asset}|5m`;
  return {
    read: {
      asset,
      stance: "possible-long",
      narrative: "read",
      invalidation: "below support",
      target: "poc",
      auction: {
        asset,
        interval: "5m",
        level: { kind: "support", price: 100, touches: 3, firstTouchedAt: 1, lastTouchedAt: at },
        profile: {
          low: 90,
          high: 110,
          binSize: 2,
          poc: 105,
          valueAreaLow: 95,
          valueAreaHigh: 108,
          bins: [],
        },
        location: "value-low",
        bias: "long",
        narrative: "auction",
        invalidation: "below support",
        target: "poc",
      },
      orderflow: {
        asset,
        windowSeconds: 5,
        lastPrice: 100,
        buyVolume: 1,
        sellVolume: 5,
        delta: -4,
        tradeCount: 6,
        averageTradeSize: 1,
        largestTrade: null,
        dominantSide: "sell",
        pressure: "sell-pressure",
        events: options?.orderflowEvents ?? ["stalled-selling"],
        narrative: "failed sell pressure",
      },
    },
    plan: {
      status: "ready",
      asset,
      side: "long",
      entryLow: 99,
      entryHigh: 101,
      stop: 98,
      target: 104,
      invalidation: "below support",
      confidence: 0.8,
      reasons: ["test"],
    },
    setup: null,
    events: options?.setupEvents ?? [{ type: "setup-ready", key: setupKey, asset, at, reason: "ready" }],
    planSource: "memory-promoted",
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
    confidence: 0.8,
    reasons: ["test"],
  };
}

function outcomeFor(entry: ReaderResultEntry, exitAt: number): ReaderResultOutcome {
  return {
    ...entry,
    exitAt,
    exitPrice: 104,
    exitReason: "target",
    r: 1,
  };
}
