import type { PositionView } from "@/app/services/positions.service";

/**
 * Dashboard positions panel. Server-rendered with the user's open trades
 * joined to live mark prices. Renders nothing when there are no positions
 * yet (early dashboard state). When Fast Trader writes a trade, this card
 * materializes.
 */
export function PositionsTable({ positions }: { positions: PositionView[] }) {
  if (positions.length === 0) return null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Positions
      </h2>

      <div className="mt-4 overflow-x-auto">
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
