import { describe, expect, test } from "bun:test";
import type { LiveReaderRead } from "../reader-live/types";
import { buildReaderTradePlan } from "./build-reader-trade-plan";

describe("buildReaderTradePlan", () => {
  test("creates a ready long plan for support with stalled selling", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "support",
        location: "value-low",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
      }),
    );

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") throw new Error("expected ready plan");
    expect(plan.side).toBe("long");
    expect(plan.entryLow).toBe(99);
    expect(plan.entryHigh).toBe(101);
    expect(plan.stop).toBe(98);
    expect(plan.target).toBe(105);
  });

  test("creates a ready short plan for resistance with stalled buying", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "resistance",
        location: "value-high",
        pressure: "buy-pressure",
        events: ["stalled-buying"],
        stance: "possible-short",
      }),
    );

    expect(plan.status).toBe("ready");
    if (plan.status !== "ready") throw new Error("expected ready plan");
    expect(plan.side).toBe("short");
    expect(plan.entryLow).toBe(99);
    expect(plan.entryHigh).toBe(101);
    expect(plan.stop).toBe(102);
    expect(plan.target).toBe(95);
  });

  test("requires long reclaim when failed selling happens below the entry zone", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
        lastPrice: 98,
      }),
    );

    expect(plan.status).toBe("ready-if-reclaim");
    if (plan.status !== "ready-if-reclaim") throw new Error("expected ready-if-reclaim plan");
    expect(plan.side).toBe("long");
    expect(plan.reasons).toContain("failed pressure is present but price still needs to reclaim the entry zone");
  });

  test("requires short reclaim when failed buying happens above the entry zone", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "resistance",
        location: "above-value",
        pressure: "buy-pressure",
        events: ["stalled-buying"],
        stance: "possible-short",
        lastPrice: 102,
      }),
    );

    expect(plan.status).toBe("ready-if-reclaim");
    if (plan.status !== "ready-if-reclaim") throw new Error("expected ready-if-reclaim plan");
    expect(plan.side).toBe("short");
    expect(plan.reasons).toContain("failed pressure is present but price still needs to reclaim the entry zone");
  });

  test("watches support when sellers press but have not failed", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "support",
        location: "below-value",
        pressure: "sell-pressure",
        events: [],
        stance: "watch-long-confirmation",
      }),
    );

    expect(plan.status).toBe("watch");
    if (plan.status !== "watch") throw new Error("expected watch plan");
    expect(plan.side).toBe("long");
  });

  test("watches resistance when buyers press but have not failed", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "resistance",
        location: "above-value",
        pressure: "buy-pressure",
        events: [],
        stance: "watch-short-confirmation",
      }),
    );

    expect(plan.status).toBe("watch");
    if (plan.status !== "watch") throw new Error("expected watch plan");
    expect(plan.side).toBe("short");
  });

  test("does not trade near POC", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "support",
        location: "near-poc",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
      }),
    );

    expect(plan.status).toBe("no-trade");
    expect(plan.reasons).toContain("price is near POC");
  });

  test("POC gravity blocks edge plans that do not target POC", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "support",
        location: "value-low",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
        profile: {
          low: 90,
          high: 120,
          binSize: 2,
          poc: 99,
          valueAreaLow: 95,
          valueAreaHigh: 115,
          bins: [],
        },
        auctionMode: {
          mode: "poc-gravity",
          allowedDirection: "both",
          reasons: ["recent edge attempt returned to POC"],
        },
      }),
    );

    expect(plan.status).toBe("no-trade");
    expect(plan.reasons[0]).toContain("poc-gravity");
  });

  test("failed expansion blocks chasing in the failed direction", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: "support",
        location: "value-low",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
        auctionMode: {
          mode: "failed-expansion",
          allowedDirection: "short",
          reasons: ["long expansion failed back into value"],
        },
      }),
    );

    expect(plan.status).toBe("no-trade");
    expect(plan.reasons[0]).toContain("failed-expansion");
  });

  test("does not trade without profile, level, or last price", () => {
    const plan = buildReaderTradePlan(
      readerRead({
        levelKind: null,
        profile: null,
        lastPrice: null,
        location: "value-low",
        pressure: "sell-pressure",
        events: ["stalled-selling"],
        stance: "possible-long",
      }),
    );

    expect(plan.status).toBe("no-trade");
    expect(plan.reasons).toContain("auction has no active support/resistance level");
    expect(plan.reasons).toContain("auction has no local volume profile");
    expect(plan.reasons).toContain("orderflow has no last traded price");
  });
});

function readerRead(input: {
  levelKind: "support" | "resistance" | null;
  location: LiveReaderRead["auction"]["location"];
  pressure: LiveReaderRead["orderflow"]["pressure"];
  events: string[];
  stance: LiveReaderRead["stance"];
  profile?: LiveReaderRead["auction"]["profile"];
  lastPrice?: number | null;
  auctionMode?: LiveReaderRead["auctionMode"];
}): LiveReaderRead {
  return {
    asset: "BTC",
    stance: input.stance,
    auctionMode: input.auctionMode,
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
      profile: input.profile === undefined
        ? {
            low: 90,
            high: 110,
            binSize: 2,
            poc: 105,
            valueAreaLow: 95,
            valueAreaHigh: 108,
            bins: [],
          }
        : input.profile,
      location: input.location,
      bias: input.levelKind === "support" ? "long" : input.levelKind === "resistance" ? "short" : "wait",
      narrative: "auction read",
      invalidation: "auction invalidation",
      target: "auction target",
    },
    orderflow: {
      asset: "BTC",
      windowSeconds: 60,
      lastPrice: input.lastPrice === undefined ? 99 : input.lastPrice,
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
