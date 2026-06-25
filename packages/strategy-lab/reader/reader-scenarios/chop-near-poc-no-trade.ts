import { bbo, candle, looseAuctionConfig, trade } from "./scenario-builders";
import type { ReaderScenario } from "./types";

export function chopNearPocNoTrade(): ReaderScenario {
  return {
    name: "chop-near-poc-no-trade",
    asset: "BTC",
    interval: "5m",
    candleIntervalMs: 1_000,
    readIntervalMs: 1_000,
    orderflowWindowMs: 5_000,
    startAt: 8_000,
    endAt: 12_000,
    candles: [
      candle(0, 100, 102, 98, 100),
      candle(1_000, 100, 102, 98, 100),
      candle(2_000, 100, 102, 98, 100),
      candle(3_000, 100, 102, 98, 100),
      candle(4_000, 100, 102, 98, 100),
      candle(5_000, 100, 102, 98, 100),
      candle(6_000, 100, 102, 98, 100),
      candle(7_000, 100, 102, 98, 100),
    ],
    orderflowEvents: [
      bbo(8_000, 99.5, 100.5),
      trade(8_000, "buy", 100.2, 1),
      trade(8_500, "sell", 99.8, 1),
      bbo(9_000, 99.5, 100.5),
      trade(9_000, "buy", 100.1, 1),
      trade(9_500, "sell", 99.9, 1),
      bbo(10_000, 99.5, 100.5),
      trade(10_000, "buy", 100.1, 1),
      trade(10_500, "sell", 99.9, 1),
    ],
    auctionConfig: looseAuctionConfig(),
  };
}



