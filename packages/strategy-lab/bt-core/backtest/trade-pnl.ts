import type { MarketCosts, Side } from "../../types";

export function tradePnl(side: Side, entry: number, exit: number, costs: MarketCosts): number {
  const gross = side === "long" ? exit / entry - 1 : entry / exit - 1;
  const roundTripCost = ((costs.feeBps + costs.slippageBps) / 10_000) * 2;
  return (gross - roundTripCost) * 100;
}

