import type {
  OrderflowBbo,
  OrderflowEvidence,
  OrderflowInitiative,
  OrderflowRead,
  OrderflowSide,
  OrderflowTapeContext,
  OrderflowTrade,
  OrderflowWindow,
} from "./types";

export function readOrderflowWindow(input: {
  asset: string;
  window: OrderflowWindow;
}): OrderflowRead {
  const stats = tapeStats(input.window.trades, input.window.startIndex);
  const dominantSide = dominantSideFor(stats.buyVolume, stats.sellVolume);
  const pressure = pressureFor(dominantSide);
  const print = printEvidence(stats.largestTrade, stats.secondLargestTradeSize, stats.tape.medianTradeSize);
  const events = eventLabels({
    window: input.window,
    pressure,
    print,
    tape: stats.tape,
    delta: stats.delta,
    largestTrade: stats.largestTrade,
    firstTrade: stats.firstTrade,
    lastTrade: stats.lastTrade,
  });
  const evidence = evidenceFor({ events, pressure, print });

  return {
    asset: input.asset,
    windowSeconds: input.window.windowMs / 1000,
    lastPrice: stats.lastTrade?.price ?? null,
    buyVolume: stats.buyVolume,
    sellVolume: stats.sellVolume,
    delta: stats.delta,
    tradeCount: stats.tradeCount,
    averageTradeSize: stats.averageTradeSize,
    largestTrade: stats.largestTrade,
    dominantSide,
    pressure,
    evidence,
    initiative: initiativeFor({
      dominantSide,
      evidence,
      tape: stats.tape,
    }),
    tape: stats.tape,
    events,
    narrative: narrativeFor(input.asset, pressure, events, stats.delta, stats.tape),
  };
}

function tapeStats(trades: OrderflowTrade[], startIndex: number): {
  buyVolume: number;
  sellVolume: number;
  delta: number;
  tradeCount: number;
  averageTradeSize: number;
  largestTrade: OrderflowTrade | null;
  secondLargestTradeSize: number;
  firstTrade: OrderflowTrade | null;
  lastTrade: OrderflowTrade | null;
  tape: OrderflowTapeContext;
} {
  let buyVolume = 0;
  let sellVolume = 0;
  let totalSize = 0;
  let largestTrade: OrderflowTrade | null = null;
  let secondLargestTradeSize = 0;
  const tradeCount = Math.max(0, trades.length - startIndex);
  const firstTrade = trades[startIndex] ?? null;
  const lastTrade = trades[trades.length - 1] ?? null;
  const sizes: number[] = [];

  for (let index = startIndex; index < trades.length; index += 1) {
    const trade = trades[index];
    if (trade.side === "buy") buyVolume += trade.size;
    else sellVolume += trade.size;
    totalSize += trade.size;
    sizes.push(trade.size);
    if (!largestTrade || trade.size > largestTrade.size) {
      secondLargestTradeSize = largestTrade?.size ?? 0;
      largestTrade = trade;
    } else if (trade.size > secondLargestTradeSize) {
      secondLargestTradeSize = trade.size;
    }
  }

  const delta = buyVolume - sellVolume;
  const totalVolume = buyVolume + sellVolume;
  const buyShare = totalVolume === 0 ? 0 : buyVolume / totalVolume;
  const sellShare = totalVolume === 0 ? 0 : sellVolume / totalVolume;
  const deltaShare = totalVolume === 0 ? 0 : delta / totalVolume;
  const dominantShare = totalVolume === 0 ? 0 : Math.max(buyShare, sellShare);
  const priceChange = firstTrade && lastTrade ? lastTrade.price - firstTrade.price : null;
  sizes.sort((left, right) => left - right);
  const medianTradeSize = medianOfSorted(sizes);

  return {
    buyVolume,
    sellVolume,
    delta,
    tradeCount,
    averageTradeSize: tradeCount === 0 ? 0 : totalSize / tradeCount,
    largestTrade,
    secondLargestTradeSize,
    firstTrade,
    lastTrade,
    tape: {
      buyShare,
      sellShare,
      deltaShare,
      dominantShare,
      largestTradeShare: largestTrade && totalVolume > 0 ? largestTrade.size / totalVolume : null,
      medianTradeSize,
      largestTradeRank: largestTrade ? rankInSorted(sizes, largestTrade.size) : null,
      lastTradeRank: lastTrade ? rankInSorted(sizes, lastTrade.size) : null,
      priceChange,
    },
  };
}

function dominantSideFor(buyVolume: number, sellVolume: number): OrderflowSide | "none" {
  if (buyVolume > sellVolume) return "buy";
  if (sellVolume > buyVolume) return "sell";
  return "none";
}

function pressureFor(dominantSide: OrderflowSide | "none"): OrderflowRead["pressure"] {
  if (dominantSide === "none") return "balanced";
  return dominantSide === "buy" ? "buy-pressure" : "sell-pressure";
}

function eventLabels(input: {
  window: OrderflowWindow;
  pressure: OrderflowRead["pressure"];
  print: OrderflowEvidence["print"];
  tape: OrderflowTapeContext;
  delta: number;
  largestTrade: OrderflowTrade | null;
  firstTrade: OrderflowTrade | null;
  lastTrade: OrderflowTrade | null;
}): string[] {
  const labels: string[] = [];
  if (input.print === "local-standout") {
    labels.push("large-print");
  }
  if (input.lastTrade) {
    const bbo = bboAtTradeTime(input.window, input.lastTrade);
    if (bbo?.askPrice !== null && bbo?.askPrice !== undefined && input.lastTrade.price >= bbo.askPrice && input.pressure === "buy-pressure") {
      labels.push("lifting-offers");
    }
    if (bbo?.bidPrice !== null && bbo?.bidPrice !== undefined && input.lastTrade.price <= bbo.bidPrice && input.pressure === "sell-pressure") {
      labels.push("hitting-bids");
    }
    if (bbo?.askPrice !== null && bbo?.askPrice !== undefined && input.lastTrade.price < bbo.askPrice && input.pressure === "buy-pressure") {
      labels.push("stalled-buying");
    }
    if (bbo?.bidPrice !== null && bbo?.bidPrice !== undefined && input.lastTrade.price > bbo.bidPrice && input.pressure === "sell-pressure") {
      labels.push("stalled-selling");
    }
    if (!bbo && input.firstTrade && input.tape.priceChange !== null) {
      if (input.pressure === "buy-pressure" && input.tape.priceChange <= 0) labels.push("stalled-buying");
      if (input.pressure === "sell-pressure" && input.tape.priceChange >= 0) labels.push("stalled-selling");
    }
  }
  if (labels.includes("stalled-buying")) {
    labels.push("buy-absorption");
    labels.push(input.print === "local-standout" ? "confirmed-absorption" : "aggressive-absorption");
  }
  if (labels.includes("stalled-selling")) {
    labels.push("sell-absorption");
    labels.push(input.print === "local-standout" ? "confirmed-absorption" : "aggressive-absorption");
  }
  if (labels.length === 0 && input.lastTrade) labels.push("thin-follow-through");
  return labels;
}

function evidenceFor(input: {
  events: string[];
  pressure: OrderflowRead["pressure"];
  print: OrderflowEvidence["print"];
}): OrderflowEvidence {
  const stalled = input.events.includes("stalled-buying") || input.events.includes("stalled-selling");
  return {
    pressure: input.pressure === "balanced" ? "none" : input.print === "local-standout" ? "confirmed" : "aggressive",
    absorption: input.events.includes("confirmed-absorption") ? "confirmed" : stalled ? "aggressive" : "none",
    print: input.print,
    followThrough: stalled
      ? "stalled"
      : input.events.includes("lifting-offers") || input.events.includes("hitting-bids")
        ? "holding"
      : "unknown",
  };
}

function initiativeFor(input: {
  dominantSide: OrderflowSide | "none";
  evidence: OrderflowEvidence;
  tape: OrderflowTapeContext;
}): OrderflowInitiative {
  if (input.dominantSide === "none" || input.evidence.pressure === "none") {
    return {
      side: "none",
      conviction: "none",
      reasons: ["orderflow has no directional pressure"],
    };
  }

  const reasons: string[] = [];
  const dominantOverwhelmsOpposite = input.tape.dominantShare >= 2 / 3;
  const printIsLocalStandout = input.evidence.print === "local-standout";
  const priceMovesWithInitiative = priceMoveSupportsSide(input.tape.priceChange, input.dominantSide);

  if (dominantOverwhelmsOpposite) reasons.push("dominant side carries at least twice the opposite-side volume");
  else reasons.push("dominant side is only mildly ahead of opposite-side volume");

  if (printIsLocalStandout) reasons.push("largest print is locally significant");
  else reasons.push("no locally significant initiative print is present");

  if (priceMovesWithInitiative) reasons.push("price moves with the dominant initiative side");
  else reasons.push("price does not confirm the dominant initiative side");

  const score = Number(dominantOverwhelmsOpposite) + Number(printIsLocalStandout) + Number(priceMovesWithInitiative);
  return {
    side: input.dominantSide,
    conviction: score === 3 ? "overwhelming" : score === 2 ? "decisive" : "mixed",
    reasons,
  };
}

function priceMoveSupportsSide(priceChange: number | null, side: OrderflowSide): boolean {
  if (priceChange === null) return false;
  return side === "buy" ? priceChange > 0 : priceChange < 0;
}

function bboAtTradeTime(window: OrderflowWindow, trade: OrderflowTrade): OrderflowBbo | null {
  for (let index = window.bboHistory.length - 1; index >= window.bboStartIndex; index -= 1) {
    const bbo = window.bboHistory[index];
    if (bbo.time <= trade.time) return bbo;
  }
  return null;
}

function rankInSorted(sortedValues: number[], value: number): number {
  if (sortedValues.length === 0) return 0;
  let lessOrEqual = 0;
  for (const candidate of sortedValues) {
    if (candidate <= value) lessOrEqual += 1;
    else break;
  }
  return lessOrEqual / sortedValues.length;
}

function medianOfSorted(sortedValues: number[]): number | null {
  if (sortedValues.length === 0) return null;
  const mid = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 1) return sortedValues[mid];
  return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

function printEvidence(
  largestTrade: OrderflowTrade | null,
  secondLargestTradeSize: number,
  medianTradeSize: number | null,
): OrderflowEvidence["print"] {
  if (!largestTrade || medianTradeSize === null) return "none";
  return largestTrade.size > secondLargestTradeSize + medianTradeSize ? "local-standout" : "none";
}

function narrativeFor(
  asset: string,
  pressure: OrderflowRead["pressure"],
  events: string[],
  delta: number,
  tape: OrderflowTapeContext,
): string {
  const rank = tape.largestTradeRank === null ? "n/a" : tape.largestTradeRank.toFixed(2);
  if (events.includes("confirmed-absorption") && events.includes("buy-absorption")) return `${asset} shows confirmed buyer absorption; largest print rank ${rank}.`;
  if (events.includes("confirmed-absorption") && events.includes("sell-absorption")) return `${asset} shows confirmed seller absorption; largest print rank ${rank}.`;
  if (events.includes("buy-absorption")) return `${asset} shows aggressive buyer absorption without standout print confirmation.`;
  if (events.includes("sell-absorption")) return `${asset} shows aggressive seller absorption without standout print confirmation.`;
  if (events.includes("stalled-buying")) return `${asset} has buy-heavy tape but buyers are not holding the offer.`;
  if (events.includes("stalled-selling")) return `${asset} has sell-heavy tape but sellers are not holding the bid.`;
  if (events.includes("lifting-offers")) return `${asset} buyers are lifting offers with positive delta ${delta.toFixed(4)}.`;
  if (events.includes("hitting-bids")) return `${asset} sellers are hitting bids with negative delta ${delta.toFixed(4)}.`;
  if (pressure === "buy-pressure") return `${asset} tape is buy-heavy with buy share ${tape.buyShare.toFixed(2)}.`;
  if (pressure === "sell-pressure") return `${asset} tape is sell-heavy with sell share ${tape.sellShare.toFixed(2)}.`;
  return `${asset} tape is balanced in the current window.`;
}
