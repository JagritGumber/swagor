import { maxDrawdown } from "./max-drawdown";
import type { BacktestMetrics, Trade } from "../../types";

export function summarizeTrades(trades: Trade[]): BacktestMetrics {
  const equityCurve = [0];
  let totalPnlPct = 0;
  let wins = 0;
  for (const trade of trades) {
    totalPnlPct += trade.pnlPct;
    if (trade.pnlPct > 0) wins++;
    equityCurve.push(totalPnlPct);
  }
  return {
    totalPnlPct,
    winRate: trades.length === 0 ? 0 : wins / trades.length,
    maxDrawdownPct: maxDrawdown(equityCurve),
  };
}

