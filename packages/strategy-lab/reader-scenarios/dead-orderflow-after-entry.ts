import { bbo, candle, looseAuctionConfig, trade } from "./scenario-builders";
import type { ReaderScenario } from "./types";

export function deadOrderflowAfterEntry(): ReaderScenario {
  return {
    name: "dead-orderflow-after-entry",
    asset: "BTC",
    interval: "5m",
    candleIntervalMs: 1_000,
    readIntervalMs: 1_000,
    orderflowWindowMs: 1_000,
    startAt: 8_000,
    endAt: 20_000,
    candles: candlesThrough(20_000),
    orderflowEvents: [
      bbo(8_000, 97.5, 98.5),
      trade(8_000, "sell", 98, 4),
      bbo(9_000, 97.8, 98.8),
      trade(9_000, "buy", 99, 1),
      bbo(20_000, 95.5, 96.5),
      trade(20_000, "sell", 96, 1),
    ],
    auctionConfig: looseAuctionConfig(),
  };
}

function candlesThrough(endAt: number) {
  const base = [
    candle(0, 105, 106, 104, 105),
    candle(1_000, 103, 104, 102, 103),
    candle(2_000, 100, 101, 99, 100),
    candle(3_000, 103, 104, 102, 103),
    candle(4_000, 106, 107, 105, 106),
    candle(5_000, 102, 103, 101, 102),
    candle(6_000, 100, 101, 99, 100),
    candle(7_000, 103, 104, 102, 103),
  ];
  for (let t = 8_000; t <= endAt; t += 1_000) {
    base.push(candle(t, 99, 100, 95, 97));
  }
  return base;
}
