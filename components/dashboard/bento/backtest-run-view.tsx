"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DailyPlanBody, type PlanJson } from "./daily-plan-body";
import { BacktestSummaryHeader, type BacktestSummary } from "./backtest-summary-header";
import { BacktestTradesTable, type BacktestTradeRow } from "./backtest-trades-table";

type Plan = {
  id: string; generatedAt: string; status: string;
  planMarkdown: string | null; planJson: PlanJson | null; errorMessage: string | null;
};
type RunDetail = {
  run: { id: string; startDate: string; endDate: string; days: number; status: string };
  plans: Plan[];
  trades: BacktestTradeRow[];
  summary: BacktestSummary;
};

export function BacktestRunView({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);

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

  async function simulate() {
    if (simulating) return;
    setSimulating(true);
    try {
      const res = await fetch(`/api/admin/backtest/runs/${runId}/simulate`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { opened: number; closed: number; skipped: number };
      toast.success(`Simulated. ${body.opened} trades, ${body.skipped} skipped.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="mt-3 border border-[var(--neon-green)] bg-[#020202]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--neon-green)]/40 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)]">
          {detail ? `${detail.run.startDate} to ${detail.run.endDate} (${detail.run.days}d)` : `backtest ${runId.slice(0, 8)}`}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={simulate} disabled={simulating} className="border border-[var(--neon-green)] bg-black px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60">
            {simulating ? "simulating..." : "simulate trades"}
          </button>
          <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:underline">close</button>
        </div>
      </header>
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
                  <header className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em]">
                    <span className="text-[var(--neon-green)]">{p.generatedAt.slice(0, 10)}</span>
                    <span className={p.status === "failed" ? "text-[var(--neon-red)]" : "text-muted-foreground"}>{p.status}</span>
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
