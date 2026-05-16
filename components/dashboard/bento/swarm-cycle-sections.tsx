"use client";

import { JsonTree } from "@/components/ui/json-tree";

export type Round = { id: string; personaId: string; reasoning: string; confidence: string | null; proposedAllocation: unknown };
export type Reasoning = { id: string; agentName: string; model: string; output: unknown; createdAt: string };
export type LlmCall = { id: string; agentName: string; model: string; promptTokens: number | null; completionTokens: number | null; rawResponse: string; createdAt: string };

function matches(needle: string, haystack: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function CycleSections({
  context, aggregation, rounds, reasoning, calls, search,
}: {
  context: unknown;
  aggregation: unknown;
  rounds: Round[];
  reasoning: Reasoning[];
  calls: LlmCall[];
  search: string;
}) {
  const filteredRounds = rounds.filter((r) => matches(search, `${r.personaId} ${r.reasoning} ${JSON.stringify(r.proposedAllocation)}`));
  const filteredReasoning = reasoning.filter((r) => matches(search, `${r.agentName} ${r.model} ${JSON.stringify(r.output)}`));
  const filteredCalls = calls.filter((c) => matches(search, `${c.agentName} ${c.model} ${c.rawResponse}`));

  return (
    <div className="space-y-4 text-sm">
      <details open>
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          context (what the swarm saw)
          {context ? "" : " - not recorded for this cycle"}
        </summary>
        <div className="mt-2">
          {context ? <JsonTree data={context} /> : (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              cycleState not stored. Older cycles ran before context audit landed.
            </p>
          )}
        </div>
      </details>
      <details open>
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">aggregation</summary>
        <div className="mt-2"><JsonTree data={aggregation} /></div>
      </details>
      <details>
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">swarm rounds ({filteredRounds.length}/{rounds.length})</summary>
        <div className="mt-2 space-y-2">
          {filteredRounds.map((r) => (
            <div key={r.id} className="border border-[var(--hairline)] p-2">
              <div className="font-mono text-[10px] uppercase text-muted-foreground">{r.personaId} · conf {r.confidence ?? "-"}</div>
              <p className="mt-1 text-xs text-foreground">{r.reasoning}</p>
              <div className="mt-2"><JsonTree data={r.proposedAllocation} /></div>
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">agent reasoning ({filteredReasoning.length}/{reasoning.length})</summary>
        <div className="mt-2 space-y-2">
          {filteredReasoning.map((r) => (
            <div key={r.id} className="border border-[var(--hairline)] p-2">
              <div className="font-mono text-[10px] uppercase text-muted-foreground">{r.agentName} · {r.model}</div>
              <div className="mt-2"><JsonTree data={r.output} /></div>
            </div>
          ))}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">llm calls ({filteredCalls.length}/{calls.length})</summary>
        <div className="mt-2 space-y-2">
          {filteredCalls.map((c) => (
            <div key={c.id} className="border border-[var(--hairline)] p-2">
              <div className="font-mono text-[10px] uppercase text-muted-foreground">{c.agentName} · {c.model} · in {c.promptTokens ?? "-"} out {c.completionTokens ?? "-"}</div>
              <pre className="mt-2 line-clamp-6 whitespace-pre-wrap text-[10px] text-foreground">{c.rawResponse}</pre>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
