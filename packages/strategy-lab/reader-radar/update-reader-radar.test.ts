import { describe, expect, test } from "bun:test";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderSetupResult } from "../reader-setup/types";
import type { ReaderTradePlan } from "../trade-plan/types";
import { createReaderRadarMemory } from "./create-reader-radar-memory";
import { updateReaderRadar } from "./update-reader-radar";

describe("updateReaderRadar", () => {
  test("keeps a rejected directional candidate alive across forming reads", () => {
    const memory = createReaderRadarMemory();

    const born = updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 1,
      setup: setupResult(noTradePlan(["reader is waiting"]), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 101 })),
    });
    const improved = updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 2,
      setup: setupResult(noTradePlan(["reader is still waiting"]), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 102 })),
    });

    expect(born.events.map((event) => event.type)).toContain("radar-born");
    expect(improved.events.map((event) => event.type)).toContain("radar-improved");
    expect(improved.candidate?.readCount).toBe(2);
    expect(improved.promoted).toBe(false);
  });

  test("does not turn POC chop into a trade candidate", () => {
    const memory = createReaderRadarMemory();
    const update = updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 1,
      setup: setupResult(noTradePlan(["balanced POC chop"]), readerRead({ location: "near-poc", pressure: "balanced", lastPrice: 100 })),
    });

    expect(update.candidate).toBeNull();
    expect(update.events.map((event) => event.type)).toContain("radar-ignored");
    expect(memory.size()).toBe(0);
  });

  test("expires stale candidates only when explicit stale policy is passed", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 1,
      setup: setupResult(noTradePlan(["reader is waiting"]), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 101 })),
    });

    const withoutPolicy = updateReaderRadar({
      memory,
      config: { mode: "shadow" },
      now: 1_001,
      setup: setupResult(noTradePlan(["other side"]), readerRead({ location: "value-high", pressure: "balanced", lastPrice: 109 })),
    });
    expect(withoutPolicy.events.map((event) => event.type)).not.toContain("radar-expired");

    const withPolicy = updateReaderRadar({
      memory,
      config: { mode: "shadow", maxStaleMs: 10 },
      now: 2_001,
      setup: setupResult(noTradePlan(["other side"]), readerRead({ location: "value-high", pressure: "balanced", lastPrice: 108 })),
    });
    expect(withPolicy.events.map((event) => event.type)).toContain("radar-expired");
  });

  test("execution mode promotes only an improving actionable candidate", () => {
    const memory = createReaderRadarMemory();
    updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 1,
      setup: setupResult(reclaimPlan("ready-if-reclaim"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 101 })),
    });
    const promoted = updateReaderRadar({
      memory,
      config: { mode: "execute" },
      now: 2,
      setup: setupResult(reclaimPlan("ready-if-reclaim"), readerRead({ location: "value-low", pressure: "balanced", lastPrice: 102 })),
    });

    expect(promoted.promoted).toBe(true);
    expect(promoted.setup.plan.status).toBe("ready");
    expect(promoted.setup.planSource).toBe("memory-promoted");
    expect(promoted.events.map((event) => event.type)).toContain("radar-promoted");
  });
});

function setupResult(plan: ReaderTradePlan, read: LiveReaderRead): ReaderSetupResult {
  return {
    read,
    plan,
    setup: plan.status === "no-trade"
      ? null
      : {
          key: "BTC|5m",
          scope: null,
          asset: "BTC",
          interval: "5m",
          side: plan.side,
          status: plan.status === "ready" ? "ready" : plan.status === "ready-if-reclaim" ? "waiting-reclaim" : "watching",
          plan,
          createdAt: 1,
          updatedAt: 1,
          lastReadAt: 1,
          readCount: 1,
          lastReason: "test setup",
        },
    events: [],
    planSource: plan.status === "no-trade" ? "none" : "fresh-read",
  };
}

function noTradePlan(reasons: string[]): ReaderTradePlan {
  return {
    status: "no-trade",
    asset: "BTC",
    setupFamily: "none",
    confidence: 0,
    reasons,
  };
}

function reclaimPlan(status: "watch" | "ready-if-reclaim" | "ready"): ReaderTradePlan {
  return {
    status,
    asset: "BTC",
    setupFamily: "reversal-reclaim",
    side: "long",
    entryLow: 100,
    entryHigh: 102,
    stop: 99,
    target: 105,
    invalidation: "invalid below 99",
    confidence: 0,
    reasons: ["test actionable reclaim"],
  };
}

function readerRead(input: {
  location: LiveReaderRead["auction"]["location"];
  pressure: LiveReaderRead["orderflow"]["pressure"];
  lastPrice: number;
}): LiveReaderRead {
  return {
    asset: "BTC",
    stance: "wait",
    narrative: "test read",
    invalidation: null,
    target: null,
    auction: {
      asset: "BTC",
      interval: "5m",
      level: {
        price: input.location === "value-high" ? 110 : 100,
        kind: input.location === "value-high" ? "resistance" : "support",
        touches: 2,
        firstTouchedAt: 1,
        lastTouchedAt: 1,
      },
      profile: {
        low: 90,
        high: 115,
        binSize: 2,
        poc: 105,
        valueAreaLow: 95,
        valueAreaHigh: 110,
        bins: [],
      },
      location: input.location,
      bias: "wait",
      narrative: "auction read",
      invalidation: null,
      target: null,
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
      events: [],
      narrative: "orderflow read",
    },
  };
}
