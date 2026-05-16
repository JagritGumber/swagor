export type BacktestSummary = {
  totalTrades: number;
  wins: number;
  losses: number;
  flat: number;
  winRate: number;
  totalPnlUsd: number;
  bestPnlUsd: number;
  worstPnlUsd: number;
};

/**
 * Reduce closed backtest trades into a single summary row the UI can
 * render at the top of the run detail view. Skips rows where pnlUsd is
 * null or non-finite. Win/loss counts use strict > 0 / < 0; exact zero
 * counts as flat so the win rate isn't distorted.
 */
export function summarizeBacktestTrades(rows: Array<{ pnlUsd: string | null }>): BacktestSummary {
  let wins = 0;
  let losses = 0;
  let flat = 0;
  let totalPnlUsd = 0;
  let bestPnlUsd = -Infinity;
  let worstPnlUsd = Infinity;
  for (const r of rows) {
    const p = r.pnlUsd === null ? null : Number(r.pnlUsd);
    if (p === null || !Number.isFinite(p)) continue;
    totalPnlUsd += p;
    if (p > 0) wins++;
    else if (p < 0) losses++;
    else flat++;
    if (p > bestPnlUsd) bestPnlUsd = p;
    if (p < worstPnlUsd) worstPnlUsd = p;
  }
  const totalTrades = wins + losses + flat;
  return {
    totalTrades, wins, losses, flat,
    winRate: totalTrades > 0 ? wins / totalTrades : 0,
    totalPnlUsd,
    bestPnlUsd: Number.isFinite(bestPnlUsd) ? bestPnlUsd : 0,
    worstPnlUsd: Number.isFinite(worstPnlUsd) ? worstPnlUsd : 0,
  };
}
