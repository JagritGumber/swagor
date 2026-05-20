import type { LifetimeStats } from "@/app/services/trades.service";

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-black px-4 py-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-2xl font-bold tabular-nums ${tone ?? "text-foreground"}`}>{value}</div>
      {sub && <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/**
 * Compact KPI instrument strip for the flagship: big scannable numbers,
 * not prose. Leads with on-chain + activity (the product); the win-rate
 * bar and paper P/L are present but neutral, not a profit headline.
 */
export function AgentVitals({ stats }: { stats: LifetimeStats }) {
  const wr = stats.winRate === null ? null : Math.round(stats.winRate * 100);
  const pnl = stats.realizedPnlUsd;
  return (
    <section className="grid grid-cols-2 gap-px border border-[var(--hairline-strong)] bg-[var(--hairline)] sm:grid-cols-4">
      <Tile label="Verified on Arc" value={String(stats.anchored)} sub="decisions on-chain" tone="text-[var(--neon-cyan)]" />
      <Tile label="Decisions" value={String(stats.closedTrades)} sub="trades closed" />
      <div className="bg-black px-4 py-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Win rate</div>
        <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">{wr === null ? "n/a" : `${wr}%`}</div>
        <div className="mt-2 h-1.5 w-full bg-[var(--hairline)]">
          <div className="h-full bg-[var(--neon-cyan)]" style={{ width: `${wr ?? 0}%` }} aria-hidden />
        </div>
      </div>
      <Tile
        label="Paper P/L"
        value={`${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`}
        sub="paper mode"
        tone={pnl > 0 ? "text-[var(--neon-green)]/80" : pnl < 0 ? "text-[var(--neon-red)]/80" : "text-foreground"}
      />
    </section>
  );
}
