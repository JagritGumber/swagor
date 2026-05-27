import type { OrderflowEvent } from "../../strategy-lab";
import type { HyperliquidWsBbo, HyperliquidWsTrade } from "./types";
import { validateHyperliquidBboData, validateHyperliquidTradesData } from "./validate-hyperliquid-orderflow-message";

export function normalizeHyperliquidOrderflowMessage(message: unknown, receivedAt: number): OrderflowEvent[] {
  const trades = validateHyperliquidTradesData(message);
  if (trades) return normalizeTrades(trades, receivedAt);
  const bbo = validateHyperliquidBboData(message);
  if (bbo) return normalizeBbo(bbo, receivedAt);
  return [];
}

function normalizeTrades(data: HyperliquidWsTrade[], receivedAt: number): OrderflowEvent[] {
  const events: OrderflowEvent[] = [];
  for (const item of data) {
    const price = Number(item.px);
    const size = Number(item.sz);
    if (!Number.isFinite(price) || !Number.isFinite(size)) continue;
    events.push({
      type: "trade",
      receivedAt,
      trade: {
        asset: item.coin.toUpperCase(),
        side: item.side === "B" ? "buy" : "sell",
        price,
        size,
        time: item.time,
        id: `${item.time}:${item.coin}:${item.tid}`,
      },
    });
  }
  return events;
}

function normalizeBbo(data: HyperliquidWsBbo, receivedAt: number): OrderflowEvent[] {
  const bid = data.bbo[0];
  const ask = data.bbo[1];
  const bidPrice = bid ? Number(bid.px) : null;
  const bidSize = bid ? Number(bid.sz) : null;
  const askPrice = ask ? Number(ask.px) : null;
  const askSize = ask ? Number(ask.sz) : null;
  if (!nullableFinite(bidPrice) || !nullableFinite(bidSize) || !nullableFinite(askPrice) || !nullableFinite(askSize)) return [];
  return [{
    type: "bbo",
    receivedAt,
    bbo: {
      asset: data.coin.toUpperCase(),
      bidPrice,
      bidSize,
      askPrice,
      askSize,
      time: data.time,
    },
  }];
}

function nullableFinite(value: number | null): boolean {
  return value === null || Number.isFinite(value);
}
