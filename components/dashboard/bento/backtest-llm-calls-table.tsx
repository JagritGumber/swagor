"use client";

export type LlmCallRow = {
  id: string; cycleId: string | null; agentName: string; model: string;
  promptTokens: number | null; completionTokens: number | null;
  costUsd: string | null; durationMs: number | null;
  createdAt: string; asOf: string | null;
};

function fmtMs(ms: number | null): string {
  if (ms === null) return "n/a";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function isLikelyLoop(c: LlmCallRow): boolean {
  return (c.completionTokens ?? 0) > 3000 || (c.durationMs ?? 0) > 30_000;
}

export function BacktestLlmCallsTable({ calls }: { calls: LlmCallRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full font-mono text-[10px] uppercase tracking-[0.14em]">
        <thead>
          <tr className="border-b border-[var(--neon-green)]/30 text-left text-muted-foreground">
            <th className="px-2 py-1">When</th><th className="px-2 py-1">Day</th>
            <th className="px-2 py-1">Agent</th><th className="px-2 py-1">Model</th>
            <th className="px-2 py-1 text-right">Duration</th>
            <th className="px-2 py-1 text-right">In</th><th className="px-2 py-1 text-right">Out</th>
            <th className="px-2 py-1 text-right">Cost</th>
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => {
            const loop = isLikelyLoop(c);
            const loopText = loop ? "text-[var(--neon-red)]" : "text-foreground";
            const loopMuted = loop ? "text-[var(--neon-red)]" : "text-muted-foreground";
            return (
              <tr key={c.id} className={`border-b border-[var(--neon-green)]/15 ${loop ? "bg-[var(--neon-red)]/10" : ""}`}>
                <td className="px-2 py-1 text-foreground">{c.createdAt.slice(11, 19)}</td>
                <td className="px-2 py-1 text-muted-foreground">{c.asOf?.slice(0, 10) ?? "-"}</td>
                <td className="px-2 py-1 text-foreground">{c.agentName}</td>
                <td className="px-2 py-1 text-muted-foreground">{c.model}</td>
                <td className={`px-2 py-1 text-right ${loopText}`}>{fmtMs(c.durationMs)}</td>
                <td className="px-2 py-1 text-right text-muted-foreground">{c.promptTokens ?? "-"}</td>
                <td className={`px-2 py-1 text-right ${loopMuted}`}>{c.completionTokens ?? "-"}</td>
                <td className="px-2 py-1 text-right text-muted-foreground">{c.costUsd ? `$${Number(c.costUsd).toFixed(4)}` : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
