"use client";

import { useEffect, useState } from "react";
import { DailyPlanBody, type PlanJson } from "./daily-plan-body";

type Plan = {
  id: string;
  generatedAt: string;
  status: string;
  planMarkdown: string | null;
  planJson: PlanJson | null;
  errorMessage: string | null;
};
type RunDetail = {
  run: { id: string; startDate: string; endDate: string; days: number; status: string };
  plans: Plan[];
};

/**
 * Expanded view of a single backtest run: shows every daily analysis
 * the swarm produced for that date window, chronologically. Each entry
 * is the same DailyPlanBody rendering the live Brain page uses so the
 * shape is familiar.
 */
export function BacktestRunView({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/backtest/runs/${runId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json() as RunDetail;
        if (!cancelled) setDetail(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [runId]);

  return (
    <div className="mt-3 border border-[var(--neon-green)] bg-[#020202]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--neon-green)]/40 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)]">
          {detail ? `${detail.run.startDate} to ${detail.run.endDate} (${detail.run.days}d)` : `backtest ${runId.slice(0, 8)}`}
        </span>
        <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:underline">
          close
        </button>
      </header>
      {error && <p className="p-4 font-mono text-xs text-[var(--neon-red)]">{error}</p>}
      {!detail && !error && <p className="p-4 font-mono text-xs text-muted-foreground">loading...</p>}
      {detail && (
        <div className="max-h-[600px] space-y-3 overflow-auto p-4">
          {detail.plans.length === 0 && (
            <p className="font-mono text-xs text-muted-foreground">No plans yet for this run.</p>
          )}
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
      )}
    </div>
  );
}
