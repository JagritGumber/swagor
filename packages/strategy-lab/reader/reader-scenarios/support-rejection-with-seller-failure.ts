import { bbo, candle, looseAuctionConfig, trade } from "./scenario-builders";
import type { ReaderScenario } from "./types";

export function supportRejectionWithSellerFailure(): ReaderScenario {
  return {
    name: "support-rejection-with-seller-failure",
    asset: "BTC",
    interval: "5m",
    candleIntervalMs: 1_000,
    readIntervalMs: 1_000,
    orderflowWindowMs: 5_000,
    startAt: 8_000,
    endAt: 10_000,
    candles: supportCandles(),
    orderflowEvents: [
      bbo(8_000, 97.5, 98.5),
      trade(8_000, "sell", 98, 4),
      bbo(9_000, 98.5, 99.5),
      trade(9_000, "sell", 99, 4),
      bbo(10_000, 104.5, 105.5),
      trade(10_000, "buy", 105, 4),
    ],
    auctionConfig: looseAuctionConfig(),
  };
}

function supportCandles() {
  return [
    candle(0, 105, 106, 104, 105),
    candle(1_000, 103, 104, 102, 103),
    candle(2_000, 100, 101, 99, 100),
    candle(3_000, 103, 104, 102, 103),
    candle(4_000, 106, 107, 105, 106),
    candle(5_000, 102, 103, 101, 102),
    candle(6_000, 100, 101, 99, 100),
    candle(7_000, 103, 104, 102, 103),
  ];
}



