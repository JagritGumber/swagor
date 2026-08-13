import type { OrderflowEvent } from "@strategy-lab";
import type { HyperliquidNetwork } from "../shared/types";
import { normalizeHyperliquidOrderflowMessage } from "./normalize-hyperliquid-orderflow-message";
import type { StoredOrderflowEvent } from "./types";

export function hyperliquidOrderflowRecords(input: {
  network: HyperliquidNetwork;
  message: unknown;
  receivedAt: number;
}): StoredOrderflowEvent[] {
  const events = normalizeHyperliquidOrderflowMessage(input.message, input.receivedAt);
  if (!isRecord(input.message)) return [];
  if (input.message.channel === "trades") return recordsByAsset(input.network, "trades", input.receivedAt, input.message.data, events);
  if (input.message.channel === "bbo") return recordsByAsset(input.network, "bbo", input.receivedAt, input.message.data, events);
  return [];
}

function recordsByAsset(
  network: HyperliquidNetwork,
  channel: "trades" | "bbo",
  receivedAt: number,
  raw: unknown,
  events: OrderflowEvent[],
): StoredOrderflowEvent[] {
  const byAsset = new Map<string, OrderflowEvent[]>();
  for (const event of events) {
    const asset = event.type === "trade" ? event.trade.asset : event.bbo.asset;
    const existing = byAsset.get(asset) ?? [];
    existing.push(event);
    byAsset.set(asset, existing);
  }
  return Array.from(byAsset.entries()).map(([asset, assetEvents]) => ({
    venue: "hyperliquid",
    network,
    asset,
    receivedAt,
    channel,
    raw,
    events: assetEvents,
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

