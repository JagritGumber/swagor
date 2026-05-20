"use client";

import { Activity, Check, Circle, X } from "lucide-react";

export const EXPECTED_SWARM_PERSONAS = 6;

export type CycleRow = { id: string; asOf: string | null; status: string; createdAt: string; completedAt: string | null; errorMessage: string | null };
export type CallRow = { id: string; agentName: string; durationMs: number | null; createdAt: string };
export type PlanRow = { generatedAt: string; arcAnchorTx: string | null; arcOnchainTxHash: string | null } | null;
export type StageState = "pending" | "running" | "done" | "failed";
export type Stage = { label: string; state: StageState; durationMs: number | null; detail?: string; meta?: string[] };

export function fmtMs(ms: number | null): string {
  if (ms === null) return "n/a";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatError(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Derive the 5 pipeline stages (context, swarm, aggregate, compile, anchor) with per-stage state + timing from the cycle's llm_calls + plan anchor fields. Shared by the vertical pipeline list and the workflow-card view. */
export function deriveStages(cycle: CycleRow, calls: CallRow[], plan: PlanRow): Stage[] {
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
    { label: "swarm", state: swarmState, durationMs: swarmMs, detail: `${personaCount}/${EXPECTED_SWARM_PERSONAS}`, meta: personaNames },
    { label: "aggregate", state: aggState, durationMs: aggMs },
    { label: "compile", state: compileState, durationMs: compiler?.durationMs ?? null },
    { label: "anchor", state: anchorState, durationMs: null, detail: anchorDetail },
  ];
}

export function StageIcon({ state }: { state: StageState }) {
  const cls = state === "done" ? "text-[var(--neon-green)]"
    : state === "running" ? "animate-pulse text-[var(--neon-cyan)]"
    : state === "failed" ? "text-[var(--neon-red)]" : "text-muted-foreground";
  const Icon = state === "done" ? Check : state === "running" ? Activity : state === "failed" ? X : Circle;
  return <Icon className={`h-3 w-3 ${cls}`} aria-hidden="true" />;
}
