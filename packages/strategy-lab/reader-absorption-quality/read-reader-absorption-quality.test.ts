import { describe, expect, test } from "bun:test";
import type { AuctionRead } from "../read-core/read/types";
import type { OrderflowRead } from "../read-core/orderflow/types";
import { readReaderAbsorptionQuality } from "./read-reader-absorption-quality";

describe("readReaderAbsorptionQuality", () => {
  test("confirms a trapped seller only when the absorbed side printed and stalled at value low", () => {
    const quality = readReaderAbsorptionQuality({
      auction: auction({ location: "value-low", levelKind: "support" }),
      orderflow: orderflow({
        events: ["sell-absorption", "confirmed-absorption"],
        lastPrice: 99,
        largestTradeSide: "sell",
        absorption: "confirmed",
        followThrough: "stalled",
        print: "local-standout",
      }),
      vpState: { auction: "rejecting-below-value", poc: "poc-stable", value: "value-stable", reasons: [] },
    });

    expect(quality.quality).toBe("trap-confirmed");
    expect(quality.side).toBe("long");
    expect(quality.absorbedSide).toBe("sell");
    expect(quality.targetMovesTowardPoc).toBe(true);
  });

  test("rejects raw absorption when the largest print does not come from the trapped side", () => {
    const quality = readReaderAbsorptionQuality({
      auction: auction({ location: "value-high", levelKind: "resistance" }),
      orderflow: orderflow({
        events: ["buy-absorption", "confirmed-absorption"],
        lastPrice: 101,
        largestTradeSide: "sell",
        absorption: "confirmed",
        followThrough: "stalled",
        print: "local-standout",
      }),
      vpState: { auction: "rejecting-above-value", poc: "poc-stable", value: "value-stable", reasons: [] },
    });

    expect(quality.quality).toBe("no-rotation");
    expect(quality.reasons).toContain("largest print is not from the absorbed attacking side");
  });

  test("marks value migration with the attacking side as continuation risk", () => {
    const quality = readReaderAbsorptionQuality({
      auction: auction({ location: "value-low", levelKind: "support" }),
      orderflow: orderflow({
        events: ["sell-absorption", "confirmed-absorption"],
        lastPrice: 99,
        largestTradeSide: "sell",
        absorption: "confirmed",
        followThrough: "stalled",
        print: "local-standout",
      }),
      vpState: { auction: "accepting-below-value", poc: "poc-migrating-down", value: "value-expanding-down", reasons: [] },
    });

    expect(quality.quality).toBe("continuation-risk");
  });
});

function auction(input: {
  location: AuctionRead["location"];
  levelKind: NonNullable<AuctionRead["level"]>["kind"];
}): AuctionRead {
  return {
    asset: "BTCUSDT",
    interval: "5m",
    level: {
      price: input.levelKind === "support" ? 98 : 102,
      kind: input.levelKind,
      touches: 3,
      firstTouchedAt: 1,
      lastTouchedAt: 2,
    },
    profile: {
      low: 95,
      high: 105,
      binSize: 1,
      poc: 100,
      valueAreaLow: 98,
      valueAreaHigh: 102,
      bins: [],
    },
    location: input.location,
    bias: "wait",
    narrative: "auction",
    invalidation: null,
    target: null,
  };
}

function orderflow(input: {
  events: string[];
  lastPrice: number;
  largestTradeSide: "buy" | "sell";
  absorption: "none" | "aggressive" | "confirmed";
  followThrough: "holding" | "stalled" | "unknown";
  print: "none" | "local-standout";
}): OrderflowRead {
  return {
    asset: "BTCUSDT",
    windowSeconds: 300,
    lastPrice: input.lastPrice,
    buyVolume: input.largestTradeSide === "buy" ? 100 : 20,
    sellVolume: input.largestTradeSide === "sell" ? 100 : 20,
    delta: input.largestTradeSide === "buy" ? 80 : -80,
    tradeCount: 100,
    averageTradeSize: 1,
    largestTrade: {
      asset: "BTCUSDT",
      side: input.largestTradeSide,
      price: input.lastPrice,
      size: 10,
      time: 1,
      id: "largest",
    },
    dominantSide: input.largestTradeSide,
    pressure: input.largestTradeSide === "buy" ? "buy-pressure" : "sell-pressure",
    evidence: {
      pressure: "confirmed",
      absorption: input.absorption,
      print: input.print,
      followThrough: input.followThrough,
    },
    events: input.events,
    narrative: "orderflow",
  };
}
