import "server-only";

export type CycleCost = {
  totalTokens: number;
  totalUsd: number | null;
  byAgent: Array<{ agentName: string; tokens: number; costUsd: number; calls: number }>;
};

export type CycleLatency = {
  totalMs: number | null;
  slowestAgent: { agentName: string; ms: number } | null;
  perAgent: Array<{ agentName: string; ms: number }>;
};

type LlmCall = {
  agentName: string;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: string | null;
  createdAt: Date;
};

/**
 * Aggregate per-cycle LLM spend from real cost_usd values stamped at log
 * time by lib/llm/log.ts. Per-agent rows sorted by USD desc so the top
 * spender surfaces first. `totalUsd` is null only when EVERY row in the
 * cycle has a null cost (unmapped model); otherwise unmapped rows
 * contribute 0 and the rest sum normally.
 */
export function computeCycleCost(calls: LlmCall[]): CycleCost {
  const acc = new Map<string, { tokens: number; costUsd: number; calls: number }>();
  let totalTokens = 0;
  let totalUsd = 0;
  let anyCost = false;
  for (const c of calls) {
    const t = (c.promptTokens ?? 0) + (c.completionTokens ?? 0);
    const u = c.costUsd !== null ? Number(c.costUsd) : 0;
    if (c.costUsd !== null) anyCost = true;
    totalTokens += t;
    totalUsd += u;
    const existing = acc.get(c.agentName) ?? { tokens: 0, costUsd: 0, calls: 0 };
    existing.tokens += t;
    existing.costUsd += u;
    existing.calls += 1;
    acc.set(c.agentName, existing);
  }
  const byAgent = Array.from(acc.entries())
    .map(([agentName, v]) => ({ agentName, ...v }))
    .sort((a, b) => b.costUsd - a.costUsd);
  return { totalTokens, totalUsd: anyCost ? Number(totalUsd.toFixed(6)) : null, byAgent };
}

/**
 * Per-call latency = createdAt - cycle.startedAt. Parallel calls land at
 * different times; the slowest agent points at the call that lagged the
 * cycle's wall-clock.
 */
export function computeCycleLatency(
  cycle: { startedAt: Date; completedAt: Date | null },
  calls: LlmCall[],
): CycleLatency {
  const startMs = cycle.startedAt.getTime();
  const totalMs = cycle.completedAt ? cycle.completedAt.getTime() - startMs : null;
  const acc = new Map<string, number>();
  for (const c of calls) {
    const ms = c.createdAt.getTime() - startMs;
    const prev = acc.get(c.agentName) ?? 0;
    if (ms > prev) acc.set(c.agentName, ms);
  }
  const perAgent = Array.from(acc.entries())
    .map(([agentName, ms]) => ({ agentName, ms }))
    .sort((a, b) => b.ms - a.ms);
  const slowestAgent = perAgent[0] ?? null;
  return { totalMs, slowestAgent, perAgent };
}
