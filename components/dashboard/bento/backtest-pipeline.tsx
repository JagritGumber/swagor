"use client";

import { useCallback, useEffect, useState } from "react";
import { BacktestPipelineCycle } from "./backtest-pipeline-cycle";

const POLL_MS = 3_000;

export type PipelineCycle = { id: string; asOf: string | null; status: string; createdAt: string; completedAt: string | null; errorMessage: string | null };
export type PipelinePlan = { cycleId: string; generatedAt: string; arcAnchorTx: string | null; arcOnchainTxHash: string | null };
type CallRow = { id: string; cycleId: string | null; agentName: string; durationMs: number | null; createdAt: string };

/**
 * Top-level pipeline view for a backtest run. Renders one strip per
 * cycle, newest first. Polls llm_calls every 3s while parent passes
 * isLive=true so a running cycle visibly advances through its stages.
 */
export function BacktestPipeline({ runId, isLive, cycles, plans }: { runId: string; isLive: boolean; cycles: PipelineCycle[]; plans: PipelinePlan[] }) {
  const [calls, setCalls] = useState<CallRow[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/backtest/runs/${runId}/llm-calls`, { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json() as { calls: CallRow[] };
      setCalls(d.calls);
    } catch { /* swallow */ }
  }, [runId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      if (cancelled) return;
      await load();
      if (cancelled) return;
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [isLive, load]);

  if (cycles.length === 0) return null;

  const callsByCycle = new Map<string, CallRow[]>();
  for (const c of calls) {
    if (!c.cycleId) continue;
    const arr = callsByCycle.get(c.cycleId) ?? [];
    arr.push(c);
    callsByCycle.set(c.cycleId, arr);
  }
  const plansByCycle = new Map<string, PipelinePlan>();
  for (const p of plans) plansByCycle.set(p.cycleId, p);

  const ordered = [...cycles].sort((a, b) => {
    const aKey = a.asOf ?? a.createdAt;
    const bKey = b.asOf ?? b.createdAt;
    return Date.parse(bKey) - Date.parse(aKey);
  });
  const runningId = ordered.find((c) => c.status === "running")?.id ?? null;

  return (
    <div className="space-y-2">
      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        Pipeline ({cycles.length} cycle{cycles.length === 1 ? "" : "s"})
      </div>
      {ordered.map((c) => (
        <BacktestPipelineCycle
          key={c.id}
          cycle={c}
          calls={callsByCycle.get(c.id) ?? []}
          plan={plansByCycle.get(c.id) ?? null}
          isCurrent={c.id === runningId}
        />
      ))}
    </div>
  );
}
