import { describe, expect, test } from "bun:test";
import type { OrderflowRead } from "../read-core/orderflow/types";
import type { AuctionRead } from "../read-core/read/types";
import type { ReaderAbsorptionQuality } from "../reader-absorption-quality/types";
import { readReaderNarrative } from "./read-reader-narrative";

describe("readReaderNarrative", () => {
  test("does not convert raw edge absorption into reversal reclaim without trap confirmation", () => {
    const narrative = readReaderNarrative({
      auction: auction(),
      orderflow: orderflow(),
      lastClosedCandle: null,
      absorptionQuality: absorptionQuality("no-rotation"),
    });

    expect(narrative.intent).toBe("wait");
    expect(narrative.reasons[0]).toContain("strict-trap rejects no-rotation");
  });

  test("allows reversal reclaim when absorption quality confirms trapped flow", () => {
    const narrative = readReaderNarrative({
      auction: auction(),
      orderflow: orderflow(),
      lastClosedCandle: null,
      absorptionQuality: absorptionQuality("trap-confirmed"),
    });

    expect(narrative.intent).toBe("reversal-reclaim");
    expect(narrative.direction).toBe("long");
  });

  test("can replay the original raw edge absorption policy as an experiment", () => {
    const narrative = readReaderNarrative({
      auction: auction(),
      orderflow: orderflow(),
      lastClosedCandle: null,
      absorptionQuality: absorptionQuality("no-rotation"),
      absorptionPolicy: "raw-edge",
    });

    expect(narrative.intent).toBe("reversal-reclaim");
    expect(narrative.direction).toBe("long");
  });

  test("allows long pullback continuation when POC migrates up without value expanding away", () => {
    const narrative = readReaderNarrative({
      auction: auction(),
      orderflow: orderflow({ pressure: "buy-pressure", events: [] }),
      lastClosedCandle: null,
      vpState: {
        poc: "poc-migrating-up",
        value: "value-stable",
        auction: "inside-value",
        reasons: [],
      },
    });

    expect(narrative.intent).toBe("continuation-pullback");
    expect(narrative.direction).toBe("long");
  });

  test("does not treat value expansion away from the pullback edge as long continuation", () => {
    const narrative = readReaderNarrative({
      auction: auction(),
      orderflow: orderflow({ pressure: "buy-pressure", events: [] }),
      lastClosedCandle: null,
      vpState: {
        poc: "poc-migrating-up",
        value: "value-expanding-up",
        auction: "inside-value",
        reasons: [],
      },
    });

    expect(narrative.intent).not.toBe("continuation-pullback");
  });
});

function auction(): AuctionRead {
  return {
    asset: "BTCUSDT",
    interval: "5m",
    level: {
      price: 98,
      kind: "support",
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
    location: "value-low",
    bias: "long",
    narrative: "auction",
    invalidation: "below support",
    target: "POC",
  };
}

function orderflow(input: {
  pressure?: OrderflowRead["pressure"];
  events?: string[];
} = {}): OrderflowRead {
  const pressure = input.pressure ?? "sell-pressure";
  const events = input.events ?? ["sell-absorption", "confirmed-absorption"];
  return {
    asset: "BTCUSDT",
    windowSeconds: 300,
    lastPrice: 99,
    buyVolume: 20,
    sellVolume: 100,
    delta: -80,
    tradeCount: 100,
    averageTradeSize: 1,
    largestTrade: {
      asset: "BTCUSDT",
      side: "sell",
      price: 99,
      size: 10,
      time: 1,
      id: "largest",
    },
    dominantSide: "sell",
    pressure,
    evidence: {
      pressure: "confirmed",
      absorption: "confirmed",
      print: "local-standout",
      followThrough: "stalled",
    },
    events,
    narrative: "orderflow",
  };
}

function absorptionQuality(quality: ReaderAbsorptionQuality["quality"]): ReaderAbsorptionQuality {
  return {
    quality,
    side: "long",
    absorbedSide: "sell",
    reasons: quality === "trap-confirmed" ? ["trap confirmed"] : ["not enough rotation"],
    auctionLocation: "value-low",
    auctionMode: "balanced-value",
    auctionPhase: "value-edge-rotation",
    vpAuction: "rejecting-below-value",
    vpPoc: "poc-stable",
    vpValue: "value-stable",
    priceToPoc: "below-poc",
    targetMovesTowardPoc: true,
    evidence: {
      absorption: "confirmed",
      print: "local-standout",
      followThrough: "stalled",
      largestTradeSideMatchesAbsorbedSide: true,
    },
  };
}
