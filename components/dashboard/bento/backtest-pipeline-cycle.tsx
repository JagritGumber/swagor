"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, Check, Circle, X } from "lucide-react";

const EXPECTED_SWARM_PERSONAS = 6;

type CycleRow = { id: string; asOf: string | null; status: string; createdAt: string; completedAt: string | null; errorMessage: string | null };
type CallRow = { id: string; agentName: string; durationMs: number | null; createdAt: string };
type PlanRow = { generatedAt: string; arcAnchorTx: string | null; arcOnchainTxHash: string | null } | null;
type StageState = "pending" | "running" | "done" | "failed";
type Stage = { label: string; state: StageState; durationMs: number | null; detail?: string; meta?: string[] };

function fmtMs(ms: number | null): string {
  if (ms === null) return "n/a";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatError(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function deriveStages(cycle: CycleRow, calls: CallRow[], plan: PlanRow): Stage[] {
  const sorted = [...calls].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const personas = sorted.filter((c) => c.agentName.startsWith("swarm:"));
  const personaNames = personas.map((c) => c.agentName.replace(/^swarm:/, "")).sort();
  const compiler = sorted.find((c) => c.agentName === "plan-compiler");
  const cycleStart = Date.parse(cycle.createdAt);
  const running = cycle.status === "running";
  const contextDone = sorted.length > 0;
  const contextMs = contextDone ? Date.parse(sorted[0].createdAt) - cycleStart : null;
  const personaCount = personas.length;
  const swarmState: StageState = personaCount >= EXPECTED_SWARM_PERSONAS ? "done" : running ? "running" : "pending";
  const swarmMs = personas.length >= 2 ? Date.parse(personas[personas.length - 1].createdAt) - Date.parse(personas[0].createdAt) : null;
  const aggState: StageState = compiler ? "done" : swarmState === "done" ? "running" : "pending";
  const lastP = personas[personas.length - 1];
  const aggMs = compiler && lastP ? Date.parse(compiler.createdAt) - Date.parse(lastP.createdAt) - (lastP.durationMs ?? 0) : null;
  const compileState: StageState = compiler ? "done" : swarmState === "done" && running ? "running" : "pending";
  let anchorState: StageState = "pending";
  let anchorDetail: string | undefined;
  if (plan?.arcOnchainTxHash?.startsWith("failed:")) { anchorState = "failed"; anchorDetail = "failed"; }
  else if (plan?.arcOnchainTxHash) { anchorState = "done"; anchorDetail = "mined"; }
  else if (plan?.arcAnchorTx) { anchorState = "running"; anchorDetail = "queued"; }
  else if (plan && cycle.status === "completed") { anchorDetail = "not anchored"; }
  return [
    { label: "context", state: contextDone ? "done" : running ? "running" : "pending", durationMs: contextMs },
    { label: `swarm (${personaCount}/${EXPECTED_SWARM_PERSONAS})`, state: swarmState, durationMs: swarmMs, meta: personaNames },
    { label: "aggregate", state: aggState, durationMs: aggMs },
    { label: "compile", state: compileState, durationMs: compiler?.durationMs ?? null },
    { label: "anchor", state: anchorState, durationMs: null, detail: anchorDetail },
  ];
}

function StageIcon({ state }: { state: StageState }) {
  const cls = state === "done" ? "text-[var(--neon-green)]"
    : state === "running" ? "animate-pulse text-[var(--neon-cyan)]"
    : state === "failed" ? "text-[var(--neon-red)]" : "text-muted-foreground";
  const Icon = state === "done" ? Check : state === "running" ? Activity : state === "failed" ? X : Circle;
  return <Icon className={`h-3 w-3 ${cls}`} aria-hidden="true" />;
}

export function BacktestPipelineCycle({ cycle, calls, plan, isCurrent }: { cycle: CycleRow; calls: CallRow[]; plan: PlanRow; isCurrent: boolean }) {
  const [open, setOpen] = useState(isCurrent);
  const userTouched = useRef(false);
  useEffect(() => {
    if (isCurrent && !userTouched.current) setOpen(true);
  }, [isCurrent]);

  const stages = deriveStages(cycle, calls, plan);
  const totalMs = cycle.completedAt ? Date.parse(cycle.completedAt) - Date.parse(cycle.createdAt) : null;
  const tone = cycle.status === "failed" ? "border-[var(--neon-red)]/40 text-[var(--neon-red)]"
    : cycle.status === "completed" ? "border-[var(--neon-green)]/30 text-[var(--neon-green)]"
    : "border-[var(--neon-cyan)]/40 text-[var(--neon-cyan)]";
  const asOfStr = cycle.asOf ? cycle.asOf.slice(0, 10) : cycle.createdAt.slice(0, 10);

  return (
    <div className={`border ${tone} bg-[#050505]`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => { userTouched.current = true; setOpen((v) => !v); }}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.16em]"
      >
        <span className="text-foreground">{asOfStr}</span>
        <span className="opacity-80">{cycle.status} / {fmtMs(totalMs)}</span>
      </button>
      {cycle.errorMessage && (
        <pre className="mx-3 mb-2 max-h-40 overflow-auto whitespace-pre-wrap break-words border border-[var(--neon-red)]/25 bg-black/50 p-2 font-mono text-[10px] normal-case tracking-normal text-[var(--neon-red)]">{formatError(cycle.errorMessage)}</pre>
      )}
      {open && (
        <ul className="border-t border-current/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em]">
          {stages.map((s) => (
            <li key={s.label} className="py-0.5">
              <div className="flex items-center gap-2">
                <StageIcon state={s.state} />
                <span className="min-w-[110px] text-foreground">{s.label}</span>
                <span className="text-muted-foreground">{fmtMs(s.durationMs)}</span>
                {s.detail && <span className="text-muted-foreground">/ {s.detail}</span>}
              </div>
              {s.meta && s.meta.length > 0 && (
                <div className="ml-5 mt-1 flex flex-wrap gap-1 normal-case tracking-normal">
                  {s.meta.map((m) => <span key={m} className="border border-current/20 px-1.5 py-0.5 text-muted-foreground">{m}</span>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
