"use client";

type Cost = {
  totalTokens: number;
  totalUsd: number | null;
};
type Latency = {
  totalMs: number | null;
  slowestAgent: { agentName: string; ms: number } | null;
};
type Warning = { severity: "info" | "warn" | "error"; message: string };

function fmtMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "n/a";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function fmtUsd(usd: number | null): string {
  if (usd === null) return "n/a";
  return `$${usd.toFixed(4)}`;
}
function toneClass(s: Warning["severity"]): string {
  if (s === "error") return "border-[var(--neon-red)] text-[var(--neon-red)]";
  if (s === "warn") return "border-[var(--neon-yellow)] text-[var(--neon-yellow)]";
  return "border-[var(--hairline-strong)] text-muted-foreground";
}

export function SwarmCycleHeader({ cost, latency, warnings }: { cost: Cost; latency: Latency; warnings: Warning[] }) {
  return (
    <div className="space-y-2 border-b border-[var(--neon-green)]/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.16em]">
        <span><span className="text-muted-foreground">cost </span><span className="text-[var(--neon-green)]">{fmtUsd(cost.totalUsd)}</span></span>
        <span><span className="text-muted-foreground">tokens </span><span className="text-foreground">{cost.totalTokens}</span></span>
        <span><span className="text-muted-foreground">wall </span><span className="text-foreground">{fmtMs(latency.totalMs)}</span></span>
        {latency.slowestAgent && (
          <span><span className="text-muted-foreground">slowest </span><span className="text-foreground">{latency.slowestAgent.agentName}</span> <span className="text-muted-foreground">{fmtMs(latency.slowestAgent.ms)}</span></span>
        )}
      </div>
      {warnings.length > 0 && (
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className={`border-l-2 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${toneClass(w.severity)}`}>
              [{w.severity}] {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
