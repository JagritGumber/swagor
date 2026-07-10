import type { OrderflowTrade } from "@judgment-shared/market/input";
import type { AbsorptionEvent, OrderflowStats } from "@judgment-shared/market/metrics";

export function createEmptyOrderflowStats(): OrderflowStats {
  return {
    buyVolume: 0,
    sellVolume: 0,
    delta: 0,
    tradeCount: 0,
    averageTradeSize: 0,
    largestTradeSize: 0,
    dominantSide: "none",
    absorption: "none",
    tapeActivity: "thin",
  };
}

export function addTradeToStats(
  stats: OrderflowStats,
  trade: OrderflowTrade,
  recentTrades: OrderflowTrade[],
): OrderflowStats {
  const buyVolume = stats.buyVolume + (trade.side === "buy" ? trade.size : 0);
  const sellVolume = stats.sellVolume + (trade.side === "sell" ? trade.size : 0);
  const delta = buyVolume - sellVolume;
  const tradeCount = stats.tradeCount + 1;
  const totalVolume = buyVolume + sellVolume;
  const averageTradeSize = tradeCount > 0 ? totalVolume / tradeCount : 0;
  const largestTradeSize = Math.max(stats.largestTradeSize, trade.size);

  let dominantSide: OrderflowStats["dominantSide"] = "none";
  if (buyVolume > sellVolume) dominantSide = "buy";
  else if (sellVolume > buyVolume) dominantSide = "sell";

  const absorption = detectAbsorption(recentTrades, buyVolume, sellVolume);
  const tapeActivity = classifyTapeActivity(tradeCount);

  return { buyVolume, sellVolume, delta, tradeCount, averageTradeSize, largestTradeSize, dominantSide, absorption, tapeActivity };
}

export function recomputeOrderflowStats(trades: OrderflowTrade[]): OrderflowStats {
  let buyVolume = 0;
  let sellVolume = 0;
  let largestTradeSize = 0;

  for (const trade of trades) {
    if (trade.side === "buy") buyVolume += trade.size;
    else sellVolume += trade.size;
    if (trade.size > largestTradeSize) largestTradeSize = trade.size;
  }

  const delta = buyVolume - sellVolume;
  const tradeCount = trades.length;
  const totalVolume = buyVolume + sellVolume;
  const averageTradeSize = tradeCount > 0 ? totalVolume / tradeCount : 0;

  let dominantSide: OrderflowStats["dominantSide"] = "none";
  if (buyVolume > sellVolume) dominantSide = "buy";
  else if (sellVolume > buyVolume) dominantSide = "sell";

  const absorption = detectAbsorption(trades, buyVolume, sellVolume);
  const tapeActivity = classifyTapeActivity(tradeCount);

  return { buyVolume, sellVolume, delta, tradeCount, averageTradeSize, largestTradeSize, dominantSide, absorption, tapeActivity };
}

export function expireOldTrades(trades: OrderflowTrade[], windowMs: number, now: number): OrderflowTrade[] {
  const cutoff = now - windowMs;
  let start = 0;
  while (start < trades.length && trades[start].time < cutoff) {
    start++;
  }
  return trades.slice(start);
}

function detectAbsorption(
  trades: OrderflowTrade[],
  buyVolume: number,
  sellVolume: number,
): AbsorptionEvent {
  if (trades.length < 3) return "none";

  const totalVolume = buyVolume + sellVolume;
  if (totalVolume === 0) return "none";

  const buyShare = buyVolume / totalVolume;
  const sellShare = sellVolume / totalVolume;

  const avgSize = totalVolume / trades.length;
  const hasLargePrint = trades.some((t) => t.size > 2 * avgSize);

  const dominantShare = Math.max(buyShare, sellShare);

  if (dominantShare >= 0.65 && hasLargePrint) {
    return buyShare > sellShare ? "buy-absorption" : "sell-absorption";
  }

  if (dominantShare >= 0.6) {
    return buyShare > sellShare ? "buy-absorption" : "sell-absorption";
  }

  return "none";
}

function classifyTapeActivity(tradeCount: number): OrderflowStats["tapeActivity"] {
  if (tradeCount < 10) return "thin";
  if (tradeCount >= 50) return "heavy";
  return "active";
}
