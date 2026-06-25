import { describe, expect, test } from "bun:test";
import { createReaderAuctionModeState } from "./create-reader-auction-mode-state";
import { readReaderAuctionMode } from "./read-reader-auction-mode";
import type { AuctionRead } from "../../read-core/read/types";
import type { OrderflowRead } from "../../read-core/orderflow/types";

describe("readReaderAuctionMode", () => {
  test("marks failed expansion when price returns into value", () => {
    const state = createReaderAuctionModeState();
    readReaderAuctionMode({ auction: auction("above-value"), orderflow: orderflow("buy-pressure"), state });
    const mode = readReaderAuctionMode({ auction: auction("value-high"), orderflow: orderflow("balanced"), state });

    expect(mode.mode).toBe("failed-expansion");
    expect(mode.phase).toBe("failed-expansion-fade");
    expect(mode.allowedDirection).toBe("short");
  });

  test("marks POC gravity after an edge attempt returns to POC", () => {
    const state = createReaderAuctionModeState();
    readReaderAuctionMode({ auction: auction("value-low"), orderflow: orderflow("sell-pressure"), state });
    const mode = readReaderAuctionMode({ auction: auction("near-poc"), orderflow: orderflow("balanced"), state });

    expect(mode.mode).toBe("poc-gravity");
    expect(mode.phase).toBe("poc-gravity-rotation");
  });

  test("marks initiative expansion when value is accepted with pressure", () => {
    const mode = readReaderAuctionMode({ auction: auction("below-value"), orderflow: orderflow("sell-pressure") });

    expect(mode.mode).toBe("initiative-expansion");
    expect(mode.phase).toBe("initiative-acceptance");
    expect(mode.allowedDirection).toBe("short");
  });

  test("labels balanced edge reads as value-edge rotation", () => {
    const mode = readReaderAuctionMode({ auction: auction("value-low"), orderflow: orderflow("balanced") });

    expect(mode.mode).toBe("balanced-value");
    expect(mode.phase).toBe("value-edge-rotation");
  });

  test("labels near POC reads as balanced wait", () => {
    const mode = readReaderAuctionMode({ auction: auction("near-poc"), orderflow: orderflow("balanced") });

    expect(mode.mode).toBe("balanced-value");
    expect(mode.phase).toBe("balanced-wait");
  });
});

function auction(location: AuctionRead["location"]): AuctionRead {
  return {
    asset: "BTC",
    interval: "5m",
    level: { price: 100, kind: location === "above-value" || location === "value-high" ? "resistance" : "support", touches: 2, firstTouchedAt: 1, lastTouchedAt: 2 },
    profile: { low: 90, high: 110, binSize: 2, poc: 100, valueAreaLow: 95, valueAreaHigh: 105, bins: [] },
    location,
    bias: "wait",
    narrative: "test auction",
    invalidation: null,
    target: null,
  };
}

function orderflow(pressure: OrderflowRead["pressure"]): OrderflowRead {
  return {
    asset: "BTC",
    windowSeconds: 60,
    lastPrice: 100,
    buyVolume: pressure === "buy-pressure" ? 10 : 4,
    sellVolume: pressure === "sell-pressure" ? 10 : 4,
    delta: pressure === "buy-pressure" ? 6 : pressure === "sell-pressure" ? -6 : 0,
    tradeCount: 4,
    averageTradeSize: 2,
    largestTrade: null,
    dominantSide: pressure === "buy-pressure" ? "buy" : pressure === "sell-pressure" ? "sell" : "none",
    pressure,
    events: [],
    narrative: "test orderflow",
  };
}



