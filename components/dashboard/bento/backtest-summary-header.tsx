"use client";

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

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "n/a";
  return `${n >= 0 ? "+" : ""}$${n.toFixed(2)}`;
}

function pnlTone(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "text-muted-foreground";
  return n > 0 ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]";
}

/**
 * Summary strip rendered above the trades table. Shows total PnL,
 * win rate, count, and best/worst single trade. All-zero summary
 * renders as a "no trades yet" hint so an unsimulated run is obvious.
 */
export function BacktestSummaryHeader({ summary }: { summary: BacktestSummary }) {
  if (summary.totalTrades === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Trade simulator has not run for this backtest yet.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em]">
      <span>
        <span className="text-muted-foreground">PnL </span>
        <span className={pnlTone(summary.totalPnlUsd)}>{fmtUsd(summary.totalPnlUsd)}</span>
      </span>
      <span>
        <span className="text-muted-foreground">Win rate </span>
        <span className="text-foreground">{(summary.winRate * 100).toFixed(0)}%</span>
        <span className="text-muted-foreground"> ({summary.wins}/{summary.totalTrades})</span>
      </span>
      <span>
        <span className="text-muted-foreground">Best </span>
        <span className="text-[var(--neon-green)]">{fmtUsd(summary.bestPnlUsd)}</span>
      </span>
      <span>
        <span className="text-muted-foreground">Worst </span>
        <span className="text-[var(--neon-red)]">{fmtUsd(summary.worstPnlUsd)}</span>
      </span>
    </div>
  );
}
