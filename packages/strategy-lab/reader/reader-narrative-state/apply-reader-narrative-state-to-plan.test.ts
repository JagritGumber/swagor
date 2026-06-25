import { describe, expect, test } from "bun:test";
import { applyReaderNarrativeStateToPlan } from "./apply-reader-narrative-state-to-plan";
import type { ReaderNarrativeState } from "./types";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderNarrative } from "../reader-narrative/types";
import type { ReaderActionableTradePlan } from "../../backtest/trade-plan/types";

describe("applyReaderNarrativeStateToPlan", () => {
  test("deteriorating thesis downgrades direct ready entry to reclaim watch", () => {
    const plan = applyReaderNarrativeStateToPlan({
      read: read(),
      plan: readyPlan(),
      state: state("deteriorating"),
    });

    expect(plan.status).toBe("ready-if-reclaim");
    expect(plan.reasons[0]).toContain("deteriorating");
  });

  test("invalidated thesis blocks the plan", () => {
    const plan = applyReaderNarrativeStateToPlan({
      read: read(),
      plan: readyPlan(),
      state: state("invalidated"),
    });

    expect(plan.status).toBe("no-trade");
    expect(plan.reasons[0]).toContain("invalidated");
  });

  test("confirmed thesis leaves the plan unchanged", () => {
    const plan = applyReaderNarrativeStateToPlan({
      read: read(),
      plan: readyPlan(),
      state: state("confirmed"),
    });

    expect(plan.status).toBe("ready");
  });
});

function state(status: ReaderNarrativeState["status"]): ReaderNarrativeState {
  return {
    key: "BTC|2025-05-01|reversal-reclaim|long|absorption|rejecting-below|value-low|support",
    asset: "BTC",
    session: "2025-05-01",
    narrative: narrative(),
    status,
    confirmations: status === "confirmed" ? 1 : 0,
    invalidations: status === "deteriorating" ? 1 : status === "invalidated" ? 2 : 0,
    lastOutcomeR: status === "confirmed" ? 2 : -1,
    lastUpdatedAt: 1,
    reasons: [`narrative thesis is ${status}`],
  };
}

function readyPlan(): ReaderActionableTradePlan {
  return {
    status: "ready",
    asset: "BTC",
    setupFamily: "reversal-reclaim",
    side: "long",
    entryLow: 99,
    entryHigh: 101,
    stop: 98,
    target: 105,
    invalidation: "below 98",
    confidence: 0,
    narrative: narrative(),
    reasons: ["ready"],
  };
}

function read(): LiveReaderRead {
  return {
    asset: "BTC",
    stance: "possible-long",
    narrativeRead: narrative(),
    narrative: "test",
    invalidation: null,
    target: null,
    auction: {
      asset: "BTC",
      interval: "5m",
      level: { kind: "support", price: 100, touches: 1, firstTouchedAt: 1, lastTouchedAt: 1 },
      profile: { low: 90, high: 110, binSize: 2, poc: 105, valueAreaLow: 95, valueAreaHigh: 108, bins: [] },
      location: "value-low",
      bias: "long",
      narrative: "auction",
      invalidation: null,
      target: null,
    },
    orderflow: {
      asset: "BTC",
      windowSeconds: 60,
      lastPrice: 100,
      buyVolume: 1,
      sellVolume: 3,
      delta: -2,
      tradeCount: 4,
      averageTradeSize: 1,
      largestTrade: null,
      dominantSide: "sell",
      pressure: "sell-pressure",
      events: ["sell-absorption"],
      narrative: "orderflow",
    },
  };
}

function narrative(): ReaderNarrative {
  return {
    intent: "reversal-reclaim",
    direction: "long",
    participation: "absorption",
    levelStory: "rejecting-below",
    reasons: ["test"],
    invalidation: null,
    target: null,
  };
}



