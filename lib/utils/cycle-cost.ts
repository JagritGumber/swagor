import "server-only";

export type CycleCost = {
  totalTokens: number;
  totalUsd: number | null;
  ratePer1k: number | null;
  byAgent: Array<{ agentName: string; tokens: number; calls: number }>;
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
  createdAt: Date;
};

/**
 * Sum tokens per agentName and multiply by the flat blended rate from
 * LLM_COST_PER_1K_TOKENS_USD. Returns null totals when the rate is not
 * configured so the UI can prompt the admin to set it. Per-agent rows
 * sorted by token count desc.
 */
export function computeCycleCost(calls: LlmCall[]): CycleCost {
  const rateStr = process.env.LLM_COST_PER_1K_TOKENS_USD;
  const ratePer1k = rateStr && Number.isFinite(Number(rateStr)) ? Number(rateStr) : null;
  const acc = new Map<string, { tokens: number; calls: number }>();
  let totalTokens = 0;
  for (const c of calls) {
    const t = (c.promptTokens ?? 0) + (c.completionTokens ?? 0);
    totalTokens += t;
    const existing = acc.get(c.agentName) ?? { tokens: 0, calls: 0 };
    existing.tokens += t;
    existing.calls += 1;
    acc.set(c.agentName, existing);
  }
  const byAgent = Array.from(acc.entries())
    .map(([agentName, v]) => ({ agentName, ...v }))
    .sort((a, b) => b.tokens - a.tokens);
  const totalUsd = ratePer1k !== null ? (totalTokens / 1000) * ratePer1k : null;
  return { totalTokens, totalUsd, ratePer1k, byAgent };
}

/**
 * Per-call latency = createdAt - cycle.startedAt. For parallel swarm
 * calls this is approximate wall-clock; for sequential pipeline stages
 * (aggregator -> plan-compiler) it's the time from cycle kickoff to
 * stage completion. Slowest agent points at the call that lagged the
 * cycle's overall wall-clock.
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
