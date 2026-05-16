"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { BacktestRunsList, type BacktestRunRow } from "./backtest-runs-list";
import { BacktestRunView } from "./backtest-run-view";

const STEP_POLL_MS = 1_500;

type StartOpts = { days: number; startDate?: string; random?: boolean };

/**
 * Admin widget: start a 30-day backtest from now, a custom UTC start
 * date, or a random month in the last year. Polls /step until done;
 * lists past runs; clicking a run opens its plans timeline.
 */
export function BacktestRunner() {
  const [runs, setRuns] = useState<BacktestRunRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ runId: string; completed: number; total: number } | null>(null);
  const [startDate, setStartDate] = useState<string>("");

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
      if (body.done) { toast.success(`Backtest done. ${body.completed}/${body.total} days.`); return; }
      if (body.reason) toast.error(`Step failure: ${body.reason}`);
      await new Promise((r) => setTimeout(r, STEP_POLL_MS));
    }
  }

  async function start(opts: StartOpts) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/backtest/run", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opts),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json() as { runId: string; days: number; startDate: string; endDate: string };
      setProgress({ runId: body.runId, completed: 0, total: body.days });
      toast.success(`Backtest started: ${body.startDate} to ${body.endDate}`);
      await loadRuns();
      await pollSteps(body.runId);
      await loadRuns();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backtest failed to start");
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  const btn = "border border-[var(--neon-green)] bg-black px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:bg-[var(--neon-green)] hover:text-black disabled:opacity-60";

  return (
    <div className="border-t border-[var(--neon-green)]/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)]">Backtest 30d from</span>
        <button onClick={() => start({ days: 30 })} disabled={busy} className={btn}>last 30 days</button>
        <button onClick={() => start({ days: 30, random: true })} disabled={busy} className={btn}>random month</button>
        <input
          type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={busy}
          className="border border-[var(--neon-green)]/40 bg-black px-2 py-1 font-mono text-[11px] text-foreground disabled:opacity-60"
        />
        <button onClick={() => startDate && start({ days: 30, startDate })} disabled={busy || !startDate} className={btn}>from date</button>
        {progress && (
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground">
            {progress.completed}/{progress.total} cycles
          </span>
        )}
      </div>
      {runs && <BacktestRunsList runs={runs} activeId={activeRunId} onSelect={setActiveRunId} />}
      {activeRunId && <BacktestRunView runId={activeRunId} onClose={() => setActiveRunId(null)} />}
    </div>
  );
}
