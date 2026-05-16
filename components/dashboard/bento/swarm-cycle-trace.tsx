"use client";

import { useEffect, useState } from "react";
import { SwarmCycleHeader } from "./swarm-cycle-header";
import { CycleSections, type LlmCall, type Reasoning, type Round } from "./swarm-cycle-sections";

type Trace = {
  cycle: { id: string; status: string; triggeredBy: string | null; errorMessage: string | null; startedAt: string; completedAt: string | null };
  swarmRounds: Round[];
  aggregation: { recommendedAllocation: unknown; dispersion: string | null; clusterSummary: unknown } | null;
  agentReasoning: Reasoning[];
  llmCalls: LlmCall[];
  context: unknown;
  summary: {
    cost: { totalTokens: number; totalUsd: number | null; ratePer1k: number | null };
    latency: { totalMs: number | null; slowestAgent: { agentName: string; ms: number } | null };
    warnings: Array<{ severity: "info" | "warn" | "error"; message: string }>;
    watchlist: string[];
  };
};

export function SwarmCycleTrace({ cycleId, onClose }: { cycleId: string; onClose: () => void }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/swarm/cycle/${cycleId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json() as Trace;
        if (!cancelled) setTrace(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => { cancelled = true; };
  }, [cycleId]);

  return (
    <div className="mt-4 border border-[var(--neon-green)] bg-[#020202]">
      <header className="flex items-center justify-between border-b border-[var(--neon-green)]/40 px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)]">cycle {cycleId.slice(0, 8)}</span>
        <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--neon-green)] hover:underline">close</button>
      </header>
      {error && <p className="p-4 font-mono text-xs text-[var(--neon-red)]">{error}</p>}
      {!trace && !error && <p className="p-4 font-mono text-xs text-muted-foreground">loading trace...</p>}
      {trace && (
        <>
          <SwarmCycleHeader cost={trace.summary.cost} latency={trace.summary.latency} warnings={trace.summary.warnings} />
          <div className="px-4 pt-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter rounds, reasoning, llm calls..."
              className="w-full border border-[var(--neon-green)]/30 bg-black px-3 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground focus:border-[var(--neon-green)] focus:outline-none"
            />
          </div>
          <div className="max-h-[600px] overflow-auto p-4">
            <CycleSections
              context={trace.context}
              aggregation={trace.aggregation}
              rounds={trace.swarmRounds}
              reasoning={trace.agentReasoning}
              calls={trace.llmCalls}
              search={search}
            />
          </div>
        </>
      )}
    </div>
  );
}
