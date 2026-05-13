import { ArrowUpRight } from "lucide-react";
import type { ClosedTradeView } from "@/app/services/trades.service";

const ARC_TX = "https://testnet.arcscan.app/tx/";

function fmtUsd(n: number | null): string {
  if (n === null) return "n/a";
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${n.toFixed(2)}`;
}

function fmtPct(n: number | null): string {
  if (n === null) return "n/a";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtTime(d: Date | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleString();
}

/**
 * Closed-trade history. Server-rendered; no client polling needed since
 * the list only grows on trade close events (rare relative to ticks).
 * Each row links to its Arc anchor tx when the on-chain hash has been
 * resolved by the poller.
 */
export function TradeHistory({ trades }: { trades: ClosedTradeView[] }) {
  if (trades.length === 0) return null;

  return (
    <section className="border border-[var(--hairline-strong)] bg-black p-6">
      <h2 className="text-2xl font-bold uppercase leading-tight text-foreground">
        Trade history
      </h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-y border-[var(--hairline-strong)]">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="py-2 text-left">Asset</th>
              <th className="py-2 text-left">Side</th>
              <th className="py-2 text-right">Size</th>
              <th className="py-2 text-right">Entry</th>
              <th className="py-2 text-right">Exit</th>
              <th className="py-2 text-right">P/L</th>
              <th className="py-2 text-right">%</th>
              <th className="py-2 text-right">Closed</th>
              <th className="py-2 text-right">Arc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {trades.map((t) => {
              const tone =
                t.pnlUsd === null
                  ? "text-foreground"
                  : t.pnlUsd >= 0
                    ? "text-[var(--neon-green)]"
                    : "text-[var(--neon-red)]";
              return (
                <tr key={t.tradeId} className="font-mono text-xs">
                  <td className="py-3 text-left text-foreground">{t.asset}</td>
                  <td className="py-3 text-left uppercase text-muted-foreground">{t.side}</td>
                  <td className="py-3 text-right text-foreground tabular-nums">${t.amountUsd.toFixed(2)}</td>
                  <td className="py-3 text-right text-muted-foreground tabular-nums">
                    {t.entryPrice ? `$${t.entryPrice.toFixed(2)}` : "-"}
                  </td>
                  <td className="py-3 text-right text-muted-foreground tabular-nums">
                    {t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : "-"}
                  </td>
                  <td className={`py-3 text-right tabular-nums ${tone}`}>{fmtUsd(t.pnlUsd)}</td>
                  <td className={`py-3 text-right tabular-nums ${tone}`}>{fmtPct(t.pnlPct)}</td>
                  <td className="py-3 text-right text-muted-foreground tabular-nums">
                    {fmtTime(t.closedAt)}
                  </td>
                  <td className="py-3 text-right">
                    {t.arcOnchainTxHash ? (
                      <a
                        href={`${ARC_TX}${t.arcOnchainTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--neon-cyan)] underline-offset-4 hover:underline"
                        title={t.arcOnchainTxHash}
                      >
                        view
                        <ArrowUpRight aria-hidden className="h-3 w-3 opacity-70" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">pending</span>
                    )}
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
