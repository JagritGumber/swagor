import type { PositionView } from "@/app/services/positions.service";

/**
 * Dashboard positions panel. Server-rendered with the user's open trades
 * joined to live mark prices. Always renders; shows an empty-state
 * message when there are no open positions yet so the user sees the
 * surface and knows what will appear when Selbo opens a trade.
 */
export function PositionsTable({ positions, bare = false }: { positions: PositionView[]; bare?: boolean }) {
  if (positions.length === 0) {
    return (
      <section className={bare ? "" : "border border-[var(--hairline-strong)] bg-black"}>
        {!bare && (
          <header className="border-b border-[var(--hairline)] px-6 py-3">
            <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
              Open trades
            </h2>
          </header>
        )}
        <div className="px-6 py-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            No open trades yet
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            When Selbo opens a paper trade, it lands here with asset,
            side, size, entry, mark, and live PnL.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={bare ? "" : "border border-[var(--hairline-strong)] bg-black"}>
      {!bare && (
        <header className="border-b border-[var(--hairline)] px-6 py-3">
          <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
            Open trades
          </h2>
        </header>
      )}

      <div className="overflow-x-auto px-6 py-4">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--hairline-strong)] text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-2 pr-4">Asset</th>
              <th className="py-2 pr-4">Side</th>
              <th className="py-2 pr-4 text-right">Size</th>
              <th className="py-2 pr-4 text-right">Entry</th>
              <th className="py-2 pr-4 text-right">Mark</th>
              <th className="py-2 pr-4 text-right">P&amp;L</th>
              <th className="py-2 text-right">When</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const pnlPositive = (p.pnlUsd ?? 0) >= 0;
              const pnlColor = pnlPositive ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]";
              return (
                <tr key={p.tradeId} className="border-b border-[var(--hairline)]">
                  <td className="py-3 pr-4 font-bold uppercase text-foreground">{p.asset}</td>
                  <td className="py-3 pr-4">
                    <span className={`font-mono text-xs uppercase tracking-[0.14em] ${p.side === "long" ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]"}`}>
                      {p.side}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                    ${p.amountUsd.toFixed(2)}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-muted-foreground tabular-nums">
                    {p.entryPrice !== null ? `$${p.entryPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono tabular-nums">
                    {p.markPrice !== null ? `$${p.markPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className={`py-3 pr-4 text-right font-mono tabular-nums ${pnlColor}`}>
                    {p.pnlUsd !== null
                      ? `${pnlPositive ? "+" : ""}$${p.pnlUsd.toFixed(2)} (${pnlPositive ? "+" : ""}${(p.pnlPct ?? 0).toFixed(2)}%)`
                      : "—"}
                  </td>
                  <td className="py-3 text-right font-mono text-xs text-muted-foreground">
                    {new Date(p.openedAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
