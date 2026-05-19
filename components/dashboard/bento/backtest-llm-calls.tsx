"use client";

import { useEffect, useState } from "react";

type Call = {
  id: string;
  cycleId: string | null;
  agentName: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: string | null;
  durationMs: number | null;
  createdAt: string;
  asOf: string | null;
};

function fmtMs(ms: number | null): string {
  if (ms === null) return "n/a";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function isLikelyLoop(call: Call): boolean {
  return (call.completionTokens ?? 0) > 3000 || (call.durationMs ?? 0) > 30_000;
}

/**
 * Surfaces every LLM call linked to the backtest's cycles, sorted by
 * recency. Rows where completionTokens > 3000 OR durationMs > 30000
 * are highlighted in red as likely stuck-loop candidates so a judge
 * (or operator) can spot which persona / model hung the cycle.
 */
export function BacktestLlmCalls({ runId }: { runId: string }) {
  const [calls, setCalls] = useState<Call[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/backtest/runs/${runId}/llm-calls`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() as Promise<{ calls: Call[] }> : Promise.reject(r.status))
      .then((d) => { if (!cancelled) setCalls(d.calls); })
      .catch((s) => { if (!cancelled) setError(`HTTP ${s}`); });
    return () => { cancelled = true; };
  }, [runId]);

  if (error) return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--neon-red)]">llm-calls: {error}</p>;
  if (!calls) return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">loading llm calls...</p>;
  if (calls.length === 0) return <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">no llm calls logged for this run yet</p>;

  return (
    <details>
      <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        LLM calls ({calls.length})
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full font-mono text-[10px] uppercase tracking-[0.14em]">
          <thead>
            <tr className="border-b border-[var(--neon-green)]/30 text-left text-muted-foreground">
              <th className="px-2 py-1">When</th>
              <th className="px-2 py-1">Day</th>
              <th className="px-2 py-1">Agent</th>
              <th className="px-2 py-1">Model</th>
              <th className="px-2 py-1 text-right">Duration</th>
              <th className="px-2 py-1 text-right">In</th>
              <th className="px-2 py-1 text-right">Out</th>
              <th className="px-2 py-1 text-right">Cost</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => {
              const loop = isLikelyLoop(c);
              return (
                <tr key={c.id} className={`border-b border-[var(--neon-green)]/15 ${loop ? "bg-[var(--neon-red)]/10" : ""}`}>
                  <td className="px-2 py-1 text-foreground">{c.createdAt.slice(11, 19)}</td>
                  <td className="px-2 py-1 text-muted-foreground">{c.asOf?.slice(0, 10) ?? "-"}</td>
                  <td className="px-2 py-1 text-foreground">{c.agentName}</td>
                  <td className="px-2 py-1 text-muted-foreground">{c.model}</td>
                  <td className={`px-2 py-1 text-right ${loop ? "text-[var(--neon-red)]" : "text-foreground"}`}>{fmtMs(c.durationMs)}</td>
                  <td className="px-2 py-1 text-right text-muted-foreground">{c.promptTokens ?? "-"}</td>
                  <td className={`px-2 py-1 text-right ${loop ? "text-[var(--neon-red)]" : "text-muted-foreground"}`}>{c.completionTokens ?? "-"}</td>
                  <td className="px-2 py-1 text-right text-muted-foreground">{c.costUsd ? `$${Number(c.costUsd).toFixed(4)}` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
