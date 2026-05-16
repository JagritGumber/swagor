"use client";

import { useEffect, useState } from "react";

type Round = { id: string; personaId: string; reasoning: string; confidence: string | null; proposedAllocation: unknown };
type Reasoning = { id: string; agentName: string; model: string; output: unknown; createdAt: string };
type LlmCall = { id: string; agentName: string; model: string; promptTokens: number | null; completionTokens: number | null; rawResponse: string; createdAt: string };

type Trace = {
  cycle: { id: string; status: string; triggeredBy: string | null; errorMessage: string | null; startedAt: string; completedAt: string | null };
  swarmRounds: Round[];
  aggregation: { recommendedAllocation: unknown; dispersion: string | null; clusterSummary: unknown } | null;
  agentReasoning: Reasoning[];
  llmCalls: LlmCall[];
};

export function SwarmCycleTrace({ cycleId, onClose }: { cycleId: string; onClose: () => void }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="mt-4 border border-[var(--hairline-strong)] bg-[#020202]">
      <header className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-foreground">cycle {cycleId.slice(0, 8)}</span>
        <button onClick={onClose} className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">close</button>
      </header>
      {error && <p className="p-4 font-mono text-xs text-[var(--neon-red)]">{error}</p>}
      {!trace && !error && <p className="p-4 font-mono text-xs text-muted-foreground">loading trace...</p>}
      {trace && (
        <div className="max-h-[600px] space-y-4 overflow-auto p-4 text-sm">
          <details open>
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">aggregation</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-foreground">{JSON.stringify(trace.aggregation, null, 2)}</pre>
          </details>
          <details>
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">swarm rounds ({trace.swarmRounds.length})</summary>
            <div className="mt-2 space-y-2">
              {trace.swarmRounds.map((r) => (
                <div key={r.id} className="border border-[var(--hairline)] p-2">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">{r.personaId} · conf {r.confidence ?? "-"}</div>
                  <p className="mt-1 text-xs text-foreground">{r.reasoning}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-[10px] text-muted-foreground">{JSON.stringify(r.proposedAllocation, null, 2)}</pre>
                </div>
              ))}
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">agent reasoning ({trace.agentReasoning.length})</summary>
            <div className="mt-2 space-y-2">
              {trace.agentReasoning.map((r) => (
                <div key={r.id} className="border border-[var(--hairline)] p-2">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">{r.agentName} · {r.model}</div>
                  <pre className="mt-2 whitespace-pre-wrap text-[10px] text-foreground">{JSON.stringify(r.output, null, 2)}</pre>
                </div>
              ))}
            </div>
          </details>
          <details>
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">llm calls ({trace.llmCalls.length})</summary>
            <div className="mt-2 space-y-2">
              {trace.llmCalls.map((c) => (
                <div key={c.id} className="border border-[var(--hairline)] p-2">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground">{c.agentName} · {c.model} · in {c.promptTokens ?? "-"} out {c.completionTokens ?? "-"}</div>
                  <pre className="mt-2 line-clamp-6 whitespace-pre-wrap text-[10px] text-foreground">{c.rawResponse}</pre>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
