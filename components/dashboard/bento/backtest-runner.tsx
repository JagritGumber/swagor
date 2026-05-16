"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BacktestRunsList, type BacktestRunRow } from "./backtest-runs-list";

const STEP_POLL_MS = 1_500;

/**
 * Admin widget: start a 7/30-day backtest, watch progress live, list
 * past runs. Each step call runs one day on the server (~16-20s); the
 * client polls /step until {done: true} so a 30-day backtest stays
 * under each request's maxDuration. Lives inside SwarmDevPanel.
 */
export function BacktestRunner() {
  const [runs, setRuns] = useState<BacktestRunRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ runId: string; completed: number; total: number } | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backtest/runs", { cache: "no-store" });
      if (res.ok) setRuns(((await res.json()) as { runs: BacktestRunRow[] }).runs);
    } catch { /* swallow */ }
  }, []);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  async function pollSteps(runId: string) {
    while (true) {
      const res = await fetch("/api/admin/backtest/step", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) throw new Error(`step HTTP ${res.status}`);
      const body = await res.json() as { done: boolean; completed: number; total: number; reason?: string };
      setProgress({ runId, completed: body.completed, total: body.total });
      if (body.done) {
        toast.success(`Backtest done. ${body.completed}/${body.total} days.`);
        return;
      }
      if (body.reason) toast.error(`Step failure: ${body.reason}`);
      await new Promise((r) => setTimeout(r, STEP_POLL_MS));
    }
  }

  async function start(days: number) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/backtest/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { runId: string; days: number };
      setProgress({ runId: body.runId, completed: 0, total: body.days });
      toast.success(`Backtest started: ${body.days} days. Polling...`);
      await pollSteps(body.runId);
      await loadRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backtest failed to start");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const btn = "border border-[var(--neon-green)] bg-black px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60";

  return (
    <div className="border-t border-[var(--neon-green)]/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)]">Backtest</span>
        <button onClick={() => start(7)} disabled={busy} className={btn}>7d</button>
        <button onClick={() => start(30)} disabled={busy} className={btn}>30d</button>
        {progress && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
            {progress.completed}/{progress.total} cycles
          </span>
        )}
      </div>
      {runs && runs.length > 0 && <BacktestRunsList runs={runs} />}
    </div>
  );
}
