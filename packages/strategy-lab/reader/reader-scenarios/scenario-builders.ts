import type { OrderflowEvent } from "@strategy-lab/read-core/orderflow/types";
import type { Candle } from "@strategy-lab/types";

export function candle(t: number, o: number, h: number, l: number, c: number, v = 10): Candle {
  return { t, o, h, l, c, v };
}

export function trade(time: number, side: "buy" | "sell", price: number, size: number, asset = "BTC"): OrderflowEvent {
  return {
    type: "trade",
    receivedAt: time,
    trade: {
      asset,
      side,
      price,
      size,
      time,
      id: `${time}:${asset}:${side}:${price}:${size}`,
    },
  };
}

export function bbo(time: number, bidPrice: number, askPrice: number, asset = "BTC"): OrderflowEvent {
  return {
    type: "bbo",
    receivedAt: time,
    bbo: {
      asset,
      bidPrice,
      bidSize: 1,
      askPrice,
      askSize: 1,
      time,
    },
  };
}

export function looseAuctionConfig() {
  return {
    swingLeft: 1,
    swingRight: 1,
    levelMinTouches: 1,
    maxLevelDistancePct: 0.05,
    profileCandles: 8,
    profileBins: 8,
  };
}



