"use client";

import { useCallback, useEffect, useState } from "react";
import { DailyPlanBody, type PlanJson } from "./daily-plan-body";
import { BacktestSummaryHeader, type BacktestSummary } from "./backtest-summary-header";
import { BacktestTradesTable, type BacktestTradeRow } from "./backtest-trades-table";
import { BacktestRunHeader } from "./backtest-run-header";
import { useBacktestControls } from "./use-backtest-controls";
import { ArcTxLink } from "@/components/ui/arc-tx-link";

type Plan = {
  id: string; generatedAt: string; status: string;
  planMarkdown: string | null; planJson: PlanJson | null; errorMessage: string | null;
  arcAnchorTx: string | null; arcOnchainTxHash: string | null;
};
type RunStatus = "running" | "completed" | "failed";
type RunDetail = {
  run: { id: string; startDate: string; endDate: string; days: number; status: RunStatus; cyclesCompleted: number };
  plans: Plan[];
  trades: BacktestTradeRow[];
  summary: BacktestSummary;
};

export function BacktestRunView({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/backtest/runs/${runId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail(await res.json() as RunDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [runId]);
  useEffect(() => { void load(); }, [load]);

  const controls = useBacktestControls(runId, load);
  const label = detail ? `${detail.run.startDate} to ${detail.run.endDate} (${detail.run.days}d)` : "loading...";

  return (
    <div className="mt-3 border border-[var(--neon-green)] bg-[#020202]">
      <BacktestRunHeader
        runId={runId}
        label={label}
        status={detail?.run.status}
        progress={detail ? { completed: detail.run.cyclesCompleted, total: detail.run.days } : null}
        controls={controls}
        onClose={onClose}
      />
      {error && <p className="p-4 font-mono text-xs text-[var(--neon-red)]">{error}</p>}
      {!detail && !error && <p className="p-4 font-mono text-xs text-muted-foreground">loading...</p>}
      {detail && (
        <div className="max-h-[600px] space-y-4 overflow-auto p-4">
          <BacktestSummaryHeader summary={detail.summary} />
          <BacktestTradesTable trades={detail.trades} />
          <details>
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Daily analyses ({detail.plans.length})
            </summary>
            <div className="mt-3 space-y-3">
              {detail.plans.map((p) => (
                <div key={p.id} className="border border-[var(--neon-green)]/30 p-3">
                  <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em]">
                    <span className="text-[var(--neon-green)]">{p.generatedAt.slice(0, 10)}</span>
                    <div className="flex items-center gap-3">
                      <ArcTxLink hash={p.arcOnchainTxHash} queuedId={p.arcAnchorTx} label="anchor" />
                      <span className={p.status === "failed" ? "text-[var(--neon-red)]" : "text-muted-foreground"}>{p.status}</span>
                    </div>
                  </header>
                  {p.status === "failed" && p.errorMessage && (
                    <p className="mt-2 font-mono text-xs text-[var(--neon-red)]">{p.errorMessage}</p>
                  )}
                  {p.status === "complete" && <DailyPlanBody planJson={p.planJson} planMarkdown={p.planMarkdown} />}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
