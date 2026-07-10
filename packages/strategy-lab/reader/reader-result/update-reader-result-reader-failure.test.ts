import { describe, expect, test } from "bun:test";
import type { LiveReaderRead } from "../reader-live/types";
import type { ReaderSetupResult } from "../reader-setup/types";
import type { ReaderTradePlan } from "@strategy-lab/backtest/trade-plan/types";
import { createReaderResultState } from "./create-reader-result-state";
import { updateReaderResult } from "./update-reader-result";

describe("updateReaderResult reader-failure exits", () => {
  test("protects positive R when live reader structure fails before target", () => {
    const state = createReaderResultState();
    state.open = {
      asset: "BTC",
      setupKey: "BTC|5m",
      setupFamily: "trend-continuation",
      side: "long",
      entryPrice: 99,
      entryAt: 1,
      entryAuctionLocation: "value-low",
      entryAuctionLevelKind: "support",
      stop: 98,
      target: 105,
      confidence: 0,
      bestFavorableR: 0,
      pricedReadsAfterEntry: 0,
      reasons: ["test open continuation"],
    };

    const update = updateReaderResult({
      state,
      now: 2,
      result: setupResult(noTradePlan(), readerRead({ location: "near-poc", lastPrice: 100 })),
    });

    expect(update.closed?.exitReason).toBe("reader-failure");
    expect(update.closed?.r).toBe(1);
    expect(update.events[0]?.type).toBe("reader-failure-exit");
    expect(state.open).toBeNull();
  });
});

function setupResult(plan: ReaderTradePlan, read: LiveReaderRead): ReaderSetupResult {
  return {
    read,
    plan,
    setup: null,
    events: [],
    planSource: "none",
  };
}

function noTradePlan(): ReaderTradePlan {
  return {
    status: "no-trade",
    asset: "BTC",
    setupFamily: "none",
    confidence: 0,
    reasons: ["test no trade"],
  };
}

function readerRead(input: {
  location: LiveReaderRead["auction"]["location"];
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
      level: null,
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
      bias: "wait",
      narrative: "auction read",
      invalidation: null,
      target: null,
    },
    orderflow: {
      asset: "BTC",
      windowSeconds: 60,
      lastPrice: input.lastPrice,
      buyVolume: 5,
      sellVolume: 5,
      delta: 0,
      tradeCount: 4,
      averageTradeSize: 2,
      largestTrade: null,
      dominantSide: "none",
      pressure: "balanced",
      events: [],
      narrative: "orderflow read",
    },
  };
}



