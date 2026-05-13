import type { LifetimeStats } from "@/app/services/trades.service";

function fmtUsd(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function fmtPct(n: number | null): string {
  if (n === null) return "n/a";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtPercentage(rate: number | null): string {
  if (rate === null) return "n/a";
  return `${Math.round(rate * 100)}%`;
}

/**
 * Selbo's lifetime stats across all closed trades. Server-rendered and
 * static -- recomputed per page load, not polled. Renders nothing until
 * the first closed trade lands so a fresh wallet doesn't show empty
 * zeros that read as "broken".
 */
export function LifetimeStats({ stats }: { stats: LifetimeStats }) {
  if (stats.closedTrades === 0) return null;

  const pnlTone =
    stats.realizedPnlUsd > 0
      ? "text-[var(--neon-green)]"
      : stats.realizedPnlUsd < 0
        ? "text-[var(--neon-red)]"
        : "text-foreground";

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <header className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
          Lifetime
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {stats.closedTrades} closed · {stats.anchored} on Arc
        </span>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-px border-y border-[var(--hairline-strong)] bg-[var(--hairline)] sm:grid-cols-4">
        <Stat label="Realized P/L" value={fmtUsd(stats.realizedPnlUsd)} toneClass={pnlTone} />
        <Stat label="Win rate" value={fmtPercentage(stats.winRate)} />
        <Stat label="Best trade" value={fmtPct(stats.bestPnlPct)} toneClass="text-[var(--neon-green)]" />
        <Stat label="Worst trade" value={fmtPct(stats.worstPnlPct)} toneClass="text-[var(--neon-red)]" />
      </div>
    </section>
  );
}

function Stat({ label, value, toneClass }: { label: string; value: string; toneClass?: string }) {
  return (
    <div className="bg-black px-5 py-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 font-mono text-xl font-bold tabular-nums ${toneClass ?? "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
