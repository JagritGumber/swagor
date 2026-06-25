import { describe, expect, test } from "bun:test";
import type { LiveReaderRead } from "../reader-live/types";
import { createReaderResultState } from "../reader-result/create-reader-result-state";
import type { ReaderResultEntry, ReaderResultOutcome } from "../reader-result/types";
import { runReaderReplay } from "./run-reader-replay";
import { summarizeReaderOutcomes } from "./summarize-reader-outcomes";

describe("runReaderReplay", () => {
  test("long support reclaim enters and reaches target", () => {
    const result = runReaderReplay({
      reads: [
        supportRead({ location: "below-value", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 98 }),
        supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 99 }),
        supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 105 }),
      ],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.outcomes[0]?.exitReason).toBe("target");
    expect(result.summary.totalR).toBe(6);
    expect(result.summary.winRate).toBe(1);
  });

  test("hostile reclaim produces no entry and avoids loss", () => {
    const result = runReaderReplay({
      reads: [
        supportRead({ location: "below-value", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 98 }),
        supportRead({ location: "value-low", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 99 }),
        supportRead({ location: "below-value", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 97 }),
      ],
    });

    expect(result.entries).toHaveLength(0);
    expect(result.outcomes).toHaveLength(0);
    expect(result.setupEvents.map((event) => event.type)).toContain("setup-invalidated");
    expect(result.summary.totalR).toBe(0);
  });

  test("context change prevents later touch from entering", () => {
    const result = runReaderReplay({
      reads: [
        supportRead({ location: "below-value", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 98 }),
        supportRead({ location: "near-poc", pressure: "balanced", events: [], stance: "wait", lastPrice: 100 }),
        supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 99 }),
      ],
    });

    expect(result.entries).toHaveLength(0);
    expect(result.outcomes).toHaveLength(0);
    expect(result.setupEvents.map((event) => event.type)).toContain("setup-invalidated");
  });

  test("short resistance reclaim enters and reaches target", () => {
    const result = runReaderReplay({
      reads: [
        resistanceRead({ location: "above-value", pressure: "buy-pressure", events: ["stalled-buying"], stance: "possible-short", lastPrice: 102 }),
        resistanceRead({ location: "value-high", pressure: "balanced", events: [], stance: "wait", lastPrice: 101 }),
        resistanceRead({ location: "value-high", pressure: "balanced", events: [], stance: "wait", lastPrice: 95 }),
      ],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.outcomes[0]?.exitReason).toBe("target");
    expect(result.outcomes[0]?.r).toBe(6);
  });

  test("stop hit produces negative R and drawdown", () => {
    const result = runReaderReplay({
      reads: [
        supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
        supportRead({ location: "below-value", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 98 }),
      ],
    });

    expect(result.outcomes[0]?.exitReason).toBe("stop");
    expect(result.summary.totalR).toBe(-1);
    expect(result.summary.maxDrawdownR).toBe(-1);
  });

  test("stale setup expiry prevents entry", () => {
    const result = runReaderReplay({
      setupConfig: { setupTtlMs: 10 },
      reads: [
        { now: 10, read: supportRead({ location: "below-value", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 98 }) },
        { now: 21, read: supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 99 }) },
      ],
    });

    expect(result.entries).toHaveLength(0);
    expect(result.setupEvents.map((event) => event.type)).toContain("setup-expired");
  });

  test("open entry remains reported when replay ends before exit", () => {
    const result = runReaderReplay({
      reads: [
        supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
        supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 100 }),
      ],
    });

    expect(result.entries).toHaveLength(1);
    expect(result.outcomes).toHaveLength(0);
    expect(result.open?.entryPrice).toBe(99);
    expect(result.summary.totalEntries).toBe(1);
  });

  test("empty read list returns zero metrics", () => {
    const result = runReaderReplay({ reads: [] });

    expect(result.summary).toEqual({
      totalReads: 0,
      totalEntries: 0,
      entriesOpened: 0,
      totalOutcomes: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalR: 0,
      averageR: 0,
      maxDrawdownR: 0,
    });
    expect(result.open).toBeNull();
  });

  test("summarizeReaderOutcomes handles mixed R outcomes", () => {
    const summary = summarizeReaderOutcomes({
      totalReads: 5,
      totalEntries: 3,
      outcomes: [
        outcome(2),
        outcome(-1),
        outcome(0.5),
      ],
    });

    expect(summary.wins).toBe(2);
    expect(summary.losses).toBe(1);
    expect(summary.totalR).toBe(1.5);
    expect(summary.averageR).toBe(0.5);
    expect(summary.maxDrawdownR).toBe(-1);
  });

  test("injected state outcomes do not leak into replay summary", () => {
    const state = createReaderResultState();
    state.outcomes.push(outcome(3));
    const result = runReaderReplay({
      resultState: state,
      reads: [
        supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
        supportRead({ location: "below-value", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 98 }),
      ],
    });

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.r).toBe(-1);
    expect(result.summary.totalR).toBe(-1);
    expect(result.resultState.outcomes).toHaveLength(2);
  });

  test("resumed open state counts total entry without counting it as opened in this run", () => {
    const state = createReaderResultState();
    state.open = openEntry();
    const result = runReaderReplay({
      resultState: state,
      reads: [
        supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 105 }),
      ],
    });

    expect(result.entries).toHaveLength(0);
    expect(result.outcomes[0]?.exitReason).toBe("target");
    expect(result.summary.totalEntries).toBe(1);
    expect(result.summary.entriesOpened).toBe(0);
  });

  test("result update states are per-step snapshots", () => {
    const result = runReaderReplay({
      reads: [
        supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
        supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 100 }),
        supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 105 }),
      ],
    });

    expect(result.resultUpdates[0]?.state.open?.entryPrice).toBe(99);
    expect(result.resultUpdates[0]?.state.outcomes).toHaveLength(0);
    expect(result.resultUpdates[2]?.state.open).toBeNull();
    expect(result.resultUpdates[2]?.state.outcomes).toHaveLength(1);
  });

  test("ttl-sensitive replay requires explicit timestamps", () => {
    expect(() => runReaderReplay({
      setupConfig: { setupTtlMs: 10 },
      reads: [
        supportRead({ location: "below-value", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 98 }),
      ],
    })).toThrow("reader replay requires explicit now timestamps when TTL-sensitive replay is enabled");
  });
});

type ReadInput = {
  location: LiveReaderRead["auction"]["location"];
  pressure: LiveReaderRead["orderflow"]["pressure"];
  events: string[];
  stance: LiveReaderRead["stance"];
  lastPrice: number | null;
};

function supportRead(input: ReadInput): LiveReaderRead {
  return readerRead({ ...input, levelKind: "support" });
}

function resistanceRead(input: ReadInput): LiveReaderRead {
  return readerRead({ ...input, levelKind: "resistance" });
}

function readerRead(input: ReadInput & { levelKind: "support" | "resistance" | null }): LiveReaderRead {
  return {
    asset: "BTC",
    stance: input.stance,
    narrative: "test read",
    invalidation: "test invalidation",
    target: "test target",
    auction: {
      asset: "BTC",
      interval: "5m",
      level: input.levelKind
        ? {
            price: 100,
            kind: input.levelKind,
            touches: 3,
            firstTouchedAt: 1,
            lastTouchedAt: 2,
          }
        : null,
      profile: {
        low: 90,
        high: 110,
        binSize: 2,
        poc: 105,
        valueAreaLow: 95,
        valueAreaHigh: 108,
        bins: [],
      },
      location: input.location,
      bias: input.levelKind === "support" ? "long" : input.levelKind === "resistance" ? "short" : "wait",
      narrative: "auction read",
      invalidation: "auction invalidation",
      target: "auction target",
    },
    orderflow: {
      asset: "BTC",
      windowSeconds: 60,
      lastPrice: input.lastPrice,
      buyVolume: input.pressure === "buy-pressure" ? 12 : 4,
      sellVolume: input.pressure === "sell-pressure" ? 12 : 4,
      delta: input.pressure === "buy-pressure" ? 8 : input.pressure === "sell-pressure" ? -8 : 0,
      tradeCount: 4,
      averageTradeSize: 2,
      largestTrade: null,
      dominantSide: input.pressure === "buy-pressure" ? "buy" : input.pressure === "sell-pressure" ? "sell" : "none",
      pressure: input.pressure,
      events: input.events,
      narrative: "orderflow read",
    },
  };
}

function openEntry(): ReaderResultEntry {
  return {
    asset: "BTC",
    setupKey: "BTC|5m",
    side: "long",
    entryPrice: 99,
    entryAt: 1,
    stop: 98,
    target: 105,
    confidence: 0.7,
    reasons: [],
  };
}

function outcome(r: number): ReaderResultOutcome {
  return {
    asset: "BTC",
    setupKey: "BTC|5m",
    side: "long" as const,
    entryPrice: 100,
    entryAt: 1,
    stop: 99,
    target: 102,
    confidence: 0.7,
    reasons: [],
    exitPrice: 100 + r,
    exitAt: 2,
    exitReason: r > 0 ? "target" as const : "stop" as const,
    r,
  };
}



