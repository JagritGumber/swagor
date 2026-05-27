import type { OrderflowEvent } from "../../strategy-lab";
import type { HyperliquidWsBbo, HyperliquidWsTrade } from "./types";

export function normalizeHyperliquidOrderflowMessage(message: unknown, receivedAt: number): OrderflowEvent[] {
  if (!isRecord(message)) return [];
  if (message.channel === "trades") return normalizeTrades(message.data, receivedAt);
  if (message.channel === "bbo") return normalizeBbo(message.data, receivedAt);
  return [];
}

function normalizeTrades(data: unknown, receivedAt: number): OrderflowEvent[] {
  if (!Array.isArray(data)) return [];
  const events: OrderflowEvent[] = [];
  for (const item of data) {
    if (!isTrade(item)) continue;
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

function normalizeBbo(data: unknown, receivedAt: number): OrderflowEvent[] {
  if (!isBbo(data)) return [];
  const bid = data.bbo[0];
  const ask = data.bbo[1];
  return [{
    type: "bbo",
    receivedAt,
    bbo: {
      asset: data.coin.toUpperCase(),
      bidPrice: bid ? Number(bid.px) : null,
      bidSize: bid ? Number(bid.sz) : null,
      askPrice: ask ? Number(ask.px) : null,
      askSize: ask ? Number(ask.sz) : null,
      time: data.time,
    },
  }];
}

function isTrade(value: unknown): value is HyperliquidWsTrade {
  return isRecord(value)
    && typeof value.coin === "string"
    && typeof value.side === "string"
    && typeof value.px === "string"
    && typeof value.sz === "string"
    && typeof value.time === "number"
    && typeof value.tid === "number";
}

function isBbo(value: unknown): value is HyperliquidWsBbo {
  return isRecord(value)
    && typeof value.coin === "string"
    && typeof value.time === "number"
    && Array.isArray(value.bbo);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
