import type { OrderflowRead, OrderflowSide, OrderflowTrade, OrderflowWindow } from "./types";

export function readOrderflowWindow(input: {
  asset: string;
  window: OrderflowWindow;
}): OrderflowRead {
  let buyVolume = 0;
  let sellVolume = 0;
  let totalSize = 0;
  let largestTrade: OrderflowTrade | null = null;
  let lastPrice: number | null = null;

  let tradeCount = 0;
  for (let i = input.window.startIndex; i < input.window.trades.length; i++) {
    const trade = input.window.trades[i];
    if (trade.side === "buy") buyVolume += trade.size;
    else sellVolume += trade.size;
    totalSize += trade.size;
    tradeCount += 1;
    lastPrice = trade.price;
    if (!largestTrade || trade.size > largestTrade.size) largestTrade = trade;
  }

  const delta = buyVolume - sellVolume;
  const dominantSide = dominantSideFor(buyVolume, sellVolume);
  const pressure = pressureFor(delta, buyVolume + sellVolume);
  const averageTradeSize = tradeCount === 0 ? 0 : totalSize / tradeCount;
  const events = eventLabels({ window: input.window, delta, largestTrade, lastPrice, averageTradeSize, tradeCount });
  return {
    asset: input.asset,
    windowSeconds: input.window.windowMs / 1000,
    lastPrice,
    buyVolume,
    sellVolume,
    delta,
    tradeCount,
    averageTradeSize,
    largestTrade,
    dominantSide,
    pressure,
    events,
    narrative: narrativeFor(input.asset, pressure, events, delta),
  };
}

function dominantSideFor(buyVolume: number, sellVolume: number): OrderflowSide | "none" {
  if (buyVolume > sellVolume) return "buy";
  if (sellVolume > buyVolume) return "sell";
  return "none";
}

function pressureFor(delta: number, totalVolume: number): OrderflowRead["pressure"] {
  if (totalVolume <= 0) return "balanced";
  const ratio = Math.abs(delta) / totalVolume;
  if (ratio < 0.18) return "balanced";
  return delta > 0 ? "buy-pressure" : "sell-pressure";
}

function eventLabels(input: {
  window: OrderflowWindow;
  delta: number;
  largestTrade: OrderflowTrade | null;
  lastPrice: number | null;
  averageTradeSize: number;
  tradeCount: number;
}): string[] {
  const labels: string[] = [];
  if (input.largestTrade && input.averageTradeSize > 0 && input.largestTrade.size >= input.averageTradeSize * 4) {
    labels.push("large-print");
  }
  if (input.window.bbo && input.lastPrice !== null) {
    const bbo = input.window.bbo;
    if (bbo.askPrice !== null && input.lastPrice >= bbo.askPrice && input.delta > 0) labels.push("lifting-offers");
    if (bbo.bidPrice !== null && input.lastPrice <= bbo.bidPrice && input.delta < 0) labels.push("hitting-bids");
    if (bbo.askPrice !== null && input.lastPrice < bbo.askPrice && input.delta > 0) labels.push("stalled-buying");
    if (bbo.bidPrice !== null && input.lastPrice > bbo.bidPrice && input.delta < 0) labels.push("stalled-selling");
  }
  if (labels.length === 0 && input.tradeCount > 0) labels.push("thin-follow-through");
  return labels;
}

function narrativeFor(asset: string, pressure: OrderflowRead["pressure"], events: string[], delta: number): string {
  if (events.includes("stalled-buying")) return `${asset} has positive delta but buyers are not holding the offer.`;
  if (events.includes("stalled-selling")) return `${asset} has negative delta but sellers are not holding the bid.`;
  if (events.includes("lifting-offers")) return `${asset} buyers are lifting offers with positive delta.`;
  if (events.includes("hitting-bids")) return `${asset} sellers are hitting bids with negative delta.`;
  if (pressure === "buy-pressure") return `${asset} orderflow is buy-heavy with delta ${delta.toFixed(4)}.`;
  if (pressure === "sell-pressure") return `${asset} orderflow is sell-heavy with delta ${delta.toFixed(4)}.`;
  return `${asset} orderflow is balanced in the current window.`;
}
