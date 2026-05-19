"use client";

import { useCallback, useEffect, useState } from "react";
import { BacktestLlmCallsTable, type LlmCallRow } from "./backtest-llm-calls-table";

const LIVE_POLL_MS = 3_000;

/**
 * Surfaces every LLM call linked to the backtest's cycles. Auto-polls
 * every 3s while parent passes isLive=true so stuck calls become
 * visible without manual reload. Manual refresh button always available.
 */
export function BacktestLlmCalls({ runId, isLive = false }: { runId: string; isLive?: boolean }) {
  const [calls, setCalls] = useState<LlmCallRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/backtest/runs/${runId}/llm-calls`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as { calls: LlmCallRow[] };
      setCalls(d.calls);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
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
      timer = setTimeout(tick, LIVE_POLL_MS);
    };
    timer = setTimeout(tick, LIVE_POLL_MS);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [isLive, load]);

  if (error) return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--neon-red)]">llm-calls: {error}</p>;
  if (!calls) return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">loading llm calls...</p>;

  return (
    <details>
      <summary className="flex cursor-pointer items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>LLM calls ({calls.length})</span>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); void load(); }}
          disabled={refreshing}
          className="border border-[var(--neon-green)]/30 px-2 py-0.5 text-[var(--neon-green)] hover:border-[var(--neon-green)] disabled:opacity-40"
        >{refreshing ? "..." : "refresh"}</button>
      </summary>
      {calls.length === 0 ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">no calls yet</p>
      ) : (
        <BacktestLlmCallsTable calls={calls} />
      )}
    </details>
  );
}
