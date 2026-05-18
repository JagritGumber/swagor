import { EquityCurve } from "@/components/dashboard/bento/equity-curve";
import { BacktestSummaryHeader } from "@/components/dashboard/bento/backtest-summary-header";
import { BacktestTradesTable, type BacktestTradeRow } from "@/components/dashboard/bento/backtest-trades-table";
import { PublicBacktestPlans } from "./public-backtest-plans";
import { summarizeBacktestTrades } from "@/app/services/backtest/summarize-trades";
import type { BacktestRun, BacktestTrade, DailyPlan } from "@/lib/db/schema";
import type { BacktestPlan } from "@/components/dashboard/bento/backtest-plans-list";

function toTradeRow(t: BacktestTrade): BacktestTradeRow {
  return {
    id: t.id, asset: t.asset, side: t.side,
    entryDate: t.entryDate.toISOString(),
    entryPrice: t.entryPrice,
    exitDate: t.exitDate ? t.exitDate.toISOString() : null,
    exitPrice: t.exitPrice,
    sizeUsd: t.sizeUsd, pnlUsd: t.pnlUsd, pnlPct: t.pnlPct,
    biasConfidence: t.biasConfidence, status: t.status, exitReason: t.exitReason,
  };
}

function toPlan(p: DailyPlan): BacktestPlan {
  return {
    id: p.id, generatedAt: p.generatedAt.toISOString(), status: p.status,
    planMarkdown: p.planMarkdown, planJson: p.planJson as BacktestPlan["planJson"],
    errorMessage: p.errorMessage, arcAnchorTx: p.arcAnchorTx, arcOnchainTxHash: p.arcOnchainTxHash,
  };
}

/**
 * Public profile sections sourced from the latest completed backtest.
 * Replaces the live equity / trade-history / decisions trio when a
 * featured backtest exists. Includes a labelling badge so judges know
 * they are looking at a simulation, not live trades.
 */
export function FeaturedBacktestSections({
  username,
  run,
  trades,
  plans,
}: {
  username: string;
  run: BacktestRun;
  trades: BacktestTrade[];
  plans: DailyPlan[];
}) {
  const tradeRows = trades.map(toTradeRow);
  const planRows = plans.map(toPlan);
  const summary = summarizeBacktestTrades(trades);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em]">
        <span className="border border-[var(--neon-cyan)] px-2 py-0.5 text-[var(--neon-cyan)]">backtest</span>
        <span className="text-muted-foreground">{run.startDate} to {run.endDate} ({run.days}d)</span>
      </div>
      <EquityCurve
        endpoint={`/api/public/selbo/${encodeURIComponent(username)}/featured-backtest/equity`}
        hideRangeSelector
      />
      <BacktestSummaryHeader summary={summary} />
      <BacktestTradesTable trades={tradeRows} />
      <PublicBacktestPlans plans={planRows} />
    </section>
  );
}
