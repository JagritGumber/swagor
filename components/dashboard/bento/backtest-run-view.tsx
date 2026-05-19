"use client";

import { useCallback, useEffect, useState } from "react";
import { BacktestSummaryHeader, type BacktestSummary } from "./backtest-summary-header";
import { BacktestTradesTable, type BacktestTradeRow } from "./backtest-trades-table";
import { BacktestRunHeader } from "./backtest-run-header";
import { BacktestPlansList, type BacktestPlan } from "./backtest-plans-list";
import { BacktestLlmCalls } from "./backtest-llm-calls";
import { EquityCurve } from "./equity-curve";
import { useBacktestControls } from "./use-backtest-controls";

const LIVE_POLL_MS = 2_000;

type RunStatus = "running" | "completed" | "failed";
type RunDetail = {
  run: { id: string; startDate: string; endDate: string; days: number; status: RunStatus; cyclesCompleted: number };
  plans: BacktestPlan[];
  trades: BacktestTradeRow[];
  summary: BacktestSummary;
};

export function BacktestRunView({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/backtest/runs/${runId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDetail(await res.json() as RunDetail);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [runId]);
  useEffect(() => { void load(); }, [load]);

  const isLive = detail?.run.status === "running";
  useEffect(() => { if (isLive) setPlansOpen(true); }, [isLive]);

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      await load();
      if (cancelled) return;
      timer = setTimeout(tick, LIVE_POLL_MS);
    };
    timer = setTimeout(tick, LIVE_POLL_MS);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [isLive, load]);

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
          <EquityCurve
            endpoint={`/api/admin/backtest/runs/${runId}/equity`}
            refreshKey={`${detail.run.status}:${detail.trades.length}`}
            hideRangeSelector
          />
          <BacktestSummaryHeader summary={detail.summary} />
          <BacktestTradesTable trades={detail.trades} />
          <BacktestPlansList plans={detail.plans} open={plansOpen} onOpenChange={setPlansOpen} />
          <BacktestLlmCalls runId={runId} />
        </div>
      )}
    </div>
  );
}
