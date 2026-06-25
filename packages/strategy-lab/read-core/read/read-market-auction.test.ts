import { describe, expect, test } from "bun:test";
import type { Candle } from "../../types";
import { readMarketAuction } from "./read-market-auction";

describe("readMarketAuction", () => {
  test("selects the active level using supplied live price instead of last closed candle", () => {
    const candles = levelCandles();

    const closedCandleRead = readMarketAuction({
      asset: "BTC",
      interval: "5m",
      candles,
      swingLeft: 1,
      swingRight: 1,
      levelMinTouches: 2,
      maxLevelDistancePct: 0.03,
      profileRadiusPct: 0.25,
      profileBins: 10,
    });
    const livePriceRead = readMarketAuction({
      asset: "BTC",
      interval: "5m",
      candles,
      swingLeft: 1,
      swingRight: 1,
      levelMinTouches: 2,
      maxLevelDistancePct: 0.03,
      profileRadiusPct: 0.25,
      profileBins: 10,
      price: 100,
    });

    expect(closedCandleRead.level?.kind).toBe("resistance");
    expect(livePriceRead.level?.kind).toBe("support");
    expect(livePriceRead.location).not.toBe(closedCandleRead.location);
  });
});

function levelCandles(): Candle[] {
  return [
    candle(0, 109, 111, 106, 110),
    candle(1, 105, 107, 100, 106),
    candle(2, 108, 110, 106, 109),
    candle(3, 111, 120, 109, 113),
    candle(4, 109, 111, 107, 110),
    candle(5, 106, 108, 100, 107),
    candle(6, 109, 112, 107, 111),
    candle(7, 114, 120, 112, 116),
    candle(8, 112, 115, 110, 113),
    candle(9, 116, 119, 114, 118),
  ];
}

function candle(t: number, o: number, h: number, l: number, c: number): Candle {
  return { t, o, h, l, c, v: 100 };
}
