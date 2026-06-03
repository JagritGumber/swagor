import type { BybitTradeRow } from "../bybit/parse-bybit-trade-csv";
import type { OrderflowBucket } from "./types";

export function aggregateOrderflowBuckets(input: {
  trades: BybitTradeRow[];
  bucketMs?: number;
}): OrderflowBucket[] {
  const bucketMs = input.bucketMs ?? 1000;
  if (!Number.isFinite(bucketMs) || bucketMs <= 0) throw new Error("bucketMs must be positive");

  const buckets = new Map<number, OrderflowBucket>();
  for (const trade of input.trades) {
    const bucketStart = Math.floor(trade.time / bucketMs) * bucketMs;
    const existing = buckets.get(bucketStart);
    if (!existing) {
      buckets.set(bucketStart, {
        bucketMs: bucketStart,
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        buyVolume: trade.side === "buy" ? trade.size : 0,
        sellVolume: trade.side === "sell" ? trade.size : 0,
        delta: trade.side === "buy" ? trade.size : -trade.size,
        tradeCount: 1,
        largestTradeSize: trade.size,
        largestTradePrice: trade.price,
        largestTradeSide: trade.side,
        lastTradePrice: trade.price,
      });
      continue;
    }

    existing.high = Math.max(existing.high, trade.price);
    existing.low = Math.min(existing.low, trade.price);
    existing.close = trade.price;
    existing.lastTradePrice = trade.price;
    existing.tradeCount += 1;
    if (trade.side === "buy") {
      existing.buyVolume += trade.size;
      existing.delta += trade.size;
    } else {
      existing.sellVolume += trade.size;
      existing.delta -= trade.size;
    }
    if (trade.size > existing.largestTradeSize) {
      existing.largestTradeSize = trade.size;
      existing.largestTradePrice = trade.price;
      existing.largestTradeSide = trade.side;
    }
  }

  return [...buckets.values()].sort((left, right) => left.bucketMs - right.bucketMs);
}
