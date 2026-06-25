import { describe, expect, test } from "bun:test";
import type { LiveReaderRead } from "../reader-live/types";
import { createReaderSetupMemory } from "../reader-setup/create-reader-setup-memory";
import { readMarketSetup } from "../reader-setup/read-market-setup";
import type { ReaderSetupMemory } from "../reader-setup/types";
import { createReaderResultState } from "./create-reader-result-state";
import { updateReaderResult } from "./update-reader-result";

describe("updateReaderResult", () => {
  test("support reclaim enters at ready tick price and reaches target", () => {
    const result = replayReader([
      supportRead({ location: "below-value", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 98 }),
      supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 99 }),
      supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 105 }),
    ]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.entryPrice).toBe(99);
    expect(result.state.outcomes).toHaveLength(1);
    expect(result.state.outcomes[0]?.exitReason).toBe("target");
    expect(result.state.outcomes[0]?.r).toBe(6);
  });

  test("hostile reclaim produces no entry and avoids later stop break", () => {
    const result = replayReader([
      supportRead({ location: "below-value", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 98 }),
      supportRead({ location: "value-low", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 99 }),
      supportRead({ location: "below-value", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 97 }),
    ]);

    expect(result.entries).toHaveLength(0);
    expect(result.state.outcomes).toHaveLength(0);
    expect(result.readerEvents).toContain("setup-invalidated");
  });

  test("changed auction context clears setup and produces no entry", () => {
    const result = replayReader([
      supportRead({ location: "below-value", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 98 }),
      supportRead({ location: "near-poc", pressure: "balanced", events: [], stance: "wait", lastPrice: 100 }),
      supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 99 }),
    ]);

    expect(result.entries).toHaveLength(0);
    expect(result.state.outcomes).toHaveLength(0);
    expect(result.readerEvents).toContain("setup-invalidated");
  });

  test("resistance reclaim enters short and reaches target", () => {
    const result = replayReader([
      resistanceRead({ location: "above-value", pressure: "buy-pressure", events: ["stalled-buying"], stance: "possible-short", lastPrice: 102 }),
      resistanceRead({ location: "value-high", pressure: "balanced", events: [], stance: "wait", lastPrice: 101 }),
      resistanceRead({ location: "value-high", pressure: "balanced", events: [], stance: "wait", lastPrice: 95 }),
    ]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.entryPrice).toBe(101);
    expect(result.state.outcomes[0]?.exitReason).toBe("target");
    expect(result.state.outcomes[0]?.r).toBe(6);
  });

  test("stale setup does not enter after expiry", () => {
    const memory = createReaderSetupMemory({ ttlMs: 10 });
    const result = replayReader(
      [
        { now: 10, read: supportRead({ location: "below-value", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 98 }) },
        { now: 21, read: supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 99 }) },
      ],
      memory,
    );

    expect(result.entries).toHaveLength(0);
    expect(result.state.outcomes).toHaveLength(0);
    expect(result.readerEvents).toContain("setup-expired");
  });

  test("ready plan with null last price does not enter", () => {
    const state = createReaderResultState();
    const readerResult = readMarketSetup({
      memory: createReaderSetupMemory(),
      now: 1,
      read: supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
    });
    const update = updateReaderResult({
      state,
      now: 2,
      result: {
        ...readerResult,
        read: {
          ...readerResult.read,
          orderflow: { ...readerResult.read.orderflow, lastPrice: null },
        },
      },
    });

    expect(update.opened).toBeNull();
    expect(update.events[0]?.type).toBe("entry-skipped");
    expect(state.open).toBeNull();
  });

  test("ready plan with target already at entry skips invalid long geometry", () => {
    const state = createReaderResultState();
    const setup = readMarketSetup({
      memory: createReaderSetupMemory(),
      now: 1,
      read: supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
    });
    const update = updateReaderResult({
      state,
      now: 1,
      result: {
        ...setup,
        plan: setup.plan.status === "ready" ? { ...setup.plan, target: 99 } : setup.plan,
      },
    });

    expect(update.opened).toBeNull();
    expect(update.events[0]?.type).toBe("entry-skipped");
    expect(update.events[0]?.reason).toBe("ready reader plan has invalid risk");
  });

  test("ready plan already through target skips instead of opening impossible fill", () => {
    const state = createReaderResultState();
    const setup = readMarketSetup({
      memory: createReaderSetupMemory(),
      now: 1,
      read: supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
    });
    const update = updateReaderResult({
      state,
      now: 1,
      result: {
        ...setup,
        plan: setup.plan.status === "ready" ? { ...setup.plan, target: 98.5 } : setup.plan,
      },
    });

    expect(update.opened).toBeNull();
    expect(update.closed).toBeNull();
    expect(update.events[0]?.type).toBe("entry-skipped");
    expect(state.open).toBeNull();
  });

  test("open trade without a price emits position-unpriced", () => {
    const state = createReaderResultState();
    const opened = readMarketSetup({
      memory: createReaderSetupMemory(),
      now: 1,
      read: supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
    });
    updateReaderResult({ state, now: 1, result: opened });
    const update = updateReaderResult({
      state,
      now: 2,
      result: {
        ...opened,
        read: {
          ...opened.read,
          orderflow: { ...opened.read.orderflow, lastPrice: null },
        },
      },
    });

    expect(update.events[0]?.type).toBe("position-unpriced");
    expect(state.open?.entryPrice).toBe(99);
  });

  test("result state caps stored events", () => {
    const state = createReaderResultState({ maxEvents: 2 });
    const setup = readMarketSetup({
      memory: createReaderSetupMemory(),
      now: 1,
      read: supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
    });

    updateReaderResult({ state, now: 1, result: setup });
    updateReaderResult({
      state,
      now: 2,
      result: { ...setup, read: { ...setup.read, orderflow: { ...setup.read.orderflow, lastPrice: 100 } } },
    });
    updateReaderResult({
      state,
      now: 3,
      result: { ...setup, read: { ...setup.read, orderflow: { ...setup.read.orderflow, lastPrice: 101 } } },
    });

    expect(state.events).toHaveLength(2);
    expect(state.events.map((event) => event.type)).toEqual(["position-held", "position-held"]);
  });

  test("open trade ignores new ready plans until exit", () => {
    const result = replayReader([
      supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
      resistanceRead({ location: "value-high", pressure: "buy-pressure", events: ["stalled-buying"], stance: "possible-short", lastPrice: 101 }),
      supportRead({ location: "value-low", pressure: "balanced", events: [], stance: "wait", lastPrice: 105 }),
    ]);

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.side).toBe("long");
    expect(result.state.outcomes[0]?.exitReason).toBe("target");
  });

  test("stop hit reports negative R", () => {
    const result = replayReader([
      supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
      supportRead({ location: "below-value", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 98 }),
    ]);

    expect(result.state.outcomes[0]?.exitReason).toBe("stop");
    expect(result.state.outcomes[0]?.r).toBe(-1);
    expect(result.resultEvents).toContain("stop-hit");
  });

  test("gap through stop exits at planned stop without inventing extra R loss", () => {
    const result = replayReader([
      supportRead({ location: "value-low", pressure: "sell-pressure", events: ["stalled-selling"], stance: "possible-long", lastPrice: 99 }),
      supportRead({ location: "below-value", pressure: "sell-pressure", events: [], stance: "watch-long-confirmation", lastPrice: 93 }),
    ]);

    expect(result.state.outcomes[0]?.exitReason).toBe("stop");
    expect(result.state.outcomes[0]?.exitPrice).toBe(98);
    expect(result.state.outcomes[0]?.r).toBe(-1);
  });
});

type ReplayInput = LiveReaderRead | { now: number; read: LiveReaderRead };

function replayReader(inputs: ReplayInput[], memory: ReaderSetupMemory = createReaderSetupMemory()) {
  const state = createReaderResultState();
  const entries = [];
  const readerEvents: string[] = [];
  const resultEvents: string[] = [];

  for (const [index, input] of inputs.entries()) {
    const step = "read" in input ? input : { now: index + 1, read: input };
    const setup = readMarketSetup({ memory, now: step.now, read: step.read });
    const update = updateReaderResult({ state, now: step.now, result: setup });
    if (update.opened) entries.push(update.opened);
    readerEvents.push(...setup.events.map((event) => event.type));
    resultEvents.push(...update.events.map((event) => event.type));
  }

  return { state, entries, readerEvents, resultEvents };
}

function supportRead(input: ReadInput): LiveReaderRead {
  return readerRead({ ...input, levelKind: "support" });
}

function resistanceRead(input: ReadInput): LiveReaderRead {
  return readerRead({ ...input, levelKind: "resistance" });
}

type ReadInput = {
  location: LiveReaderRead["auction"]["location"];
  pressure: LiveReaderRead["orderflow"]["pressure"];
  events: string[];
  stance: LiveReaderRead["stance"];
  lastPrice: number | null;
};

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



